import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  loadApplications,
  loadRecommendation,
  markApplicationSent,
  updateApplicationStatus,
} from '../api/jobs';
import type {
  Application,
  ApplicationStatus,
  Job,
  JobLane,
  RecommendationResponse,
} from '../types/job';

const LANE_LABEL: Record<JobLane, string> = {
  'react-native': 'React Native',
  'legacy-dotnet': '.NET / SQL',
  advisory: 'Advisory',
};

const POLL_MS = 5 * 60 * 1000;

function formatPostedAt(iso: string): string {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function JobInboxScreen() {
  const insets = useSafeAreaInsets();
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(
    null,
  );
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (mode: 'full' | 'silent' = 'full') => {
    if (mode === 'full') {
      setIsLoading(true);
    }
    const [payload, pipeline] = await Promise.all([
      loadRecommendation(mode === 'full'),
      loadApplications().catch(() => []),
    ]);
    setRecommendation(payload);
    setApplications(pipeline);
    if (mode === 'full') {
      setIsLoading(false);
    }
  }, []);

  const refreshPipeline = useCallback(async () => {
    setApplications(await loadApplications());
  }, []);

  useEffect(() => {
    void refresh('full');
    const timer = setInterval(() => {
      void refresh('silent');
    }, POLL_MS);
    const appState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        void refresh('silent');
      }
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [refresh]);

  const sourceLabel =
    recommendation?.source === 'freelancer'
      ? 'Freelancer live'
      : recommendation?.source === 'upwork'
        ? 'Upwork live'
        : recommendation?.source === 'offline'
          ? 'Server offline'
          : 'Mock data';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.kicker}>ApplyFlow</Text>
      <Text style={styles.title}>One call</Text>
      <Text style={styles.subtitle}>
        The desk watches Freelancer every 5 minutes. You get a notification on BID
        even if ApplyFlow is closed.
      </Text>
      {recommendation?.scannedAt ? (
        <Text style={styles.meta}>Last scan {formatPostedAt(recommendation.scannedAt)}</Text>
      ) : null}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sourceLabel}</Text>
        </View>
        <Pressable onPress={() => void refresh('full')} hitSlop={8}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading || recommendation == null ? (
        <ActivityIndicator color="#C8F14A" style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}>
          {recommendation.source === 'offline' ? (
            <OfflineCard recommendation={recommendation} />
          ) : recommendation.verdict === 'BID' && recommendation.job != null ? (
            <BidCard
              recommendation={recommendation}
              job={recommendation.job}
              alreadySent={applications.some(item => item.job.id === recommendation.job?.id)}
              onSent={async () => {
                if (recommendation.job == null) {
                  return;
                }
                await markApplicationSent(
                  recommendation.job,
                  recommendation.bidText ?? '',
                );
                await refresh();
              }}
            />
          ) : (
            <NoBidCard recommendation={recommendation} />
          )}
          <PipelineList
            applications={applications}
            onStatus={async (id, status) => {
              await updateApplicationStatus(id, status);
              await refreshPipeline();
            }}
          />
        </ScrollView>
      )}
    </View>
  );
}

function BidCard({
  recommendation,
  job,
  alreadySent,
  onSent,
}: {
  recommendation: RecommendationResponse;
  job: Job;
  alreadySent: boolean;
  onSent: () => Promise<void>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.verdictBid}>BID</Text>
        <Text style={styles.posted}>{formatPostedAt(job.postedAt)}</Text>
      </View>
      <Text style={styles.lane}>{LANE_LABEL[job.lane]}</Text>
      <Text style={styles.cardTitle}>{job.title}</Text>
      <Text style={styles.meta}>
        {job.budgetLabel} · {job.proposals} bids ·{' '}
        {job.client.verifiedPayment ? 'Verified' : 'Unverified'}
        {job.client.countryCode ? ` · ${job.client.countryCode}` : ''}
      </Text>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>Fit {job.fitScore}</Text>
        <Text style={styles.score}>Client {job.qualityScore}</Text>
        <Text style={styles.score}>
          {recommendation.reviewed} reviewed
        </Text>
      </View>
      <Text style={styles.reason}>{recommendation.reason}</Text>
      {recommendation.bidText ? (
        <Text style={styles.bidText}>{recommendation.bidText}</Text>
      ) : null}
      <Pressable
        style={styles.cta}
        onPress={() => {
          if (recommendation.bidText) {
            void Share.share({ message: recommendation.bidText });
          }
        }}>
        <Text style={styles.ctaText}>Share bid text</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryCta}
        onPress={() => {
          void Linking.openURL(job.upworkUrl);
        }}>
        <Text style={styles.secondaryCtaText}>Open listing</Text>
      </Pressable>
      {alreadySent ? (
        <Text style={styles.meta}>Already in the pipeline as sent.</Text>
      ) : (
        <Pressable
          style={styles.secondaryCta}
          onPress={() => {
            void onSent();
          }}>
          <Text style={styles.secondaryCtaText}>I sent this</Text>
        </Pressable>
      )}
    </View>
  );
}

function PipelineList({
  applications,
  onStatus,
}: {
  applications: Application[];
  onStatus: (id: string, status: ApplicationStatus) => Promise<void>;
}) {
  return (
    <View style={styles.pipeline}>
      <Text style={styles.pipelineTitle}>Pipeline</Text>
      {applications.length === 0 ? (
        <Text style={styles.meta}>
          Empty until you send a BID. Then you only watch status here.
        </Text>
      ) : (
        applications.map(application => (
          <View key={application.id} style={styles.pipelineCard}>
            <Text style={styles.lane}>{application.status.toUpperCase()}</Text>
            <Text style={styles.pipelineJob}>{application.job.title}</Text>
            <Text style={styles.meta}>{application.job.budgetLabel}</Text>
            <Pressable
              onPress={() => {
                void Linking.openURL(application.job.upworkUrl);
              }}>
              <Text style={styles.refresh}>Open listing</Text>
            </Pressable>
            {application.status === 'sent' ? (
              <View style={styles.scoreRow}>
                <Pressable
                  onPress={() => {
                    void onStatus(application.id, 'won');
                  }}>
                  <Text style={styles.score}>Won</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void onStatus(application.id, 'lost');
                  }}>
                  <Text style={styles.score}>Lost</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function OfflineCard({ recommendation }: { recommendation: RecommendationResponse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.verdictSkip}>OFFLINE</Text>
      <Text style={styles.cardTitle}>Live desk is not reachable</Text>
      <Text style={styles.reason}>{recommendation.reason}</Text>
      <Text style={styles.meta}>
        Same Wi-Fi as the Mac. Allow local network if iOS asks. Then tap Refresh.
      </Text>
    </View>
  );
}

function NoBidCard({ recommendation }: { recommendation: RecommendationResponse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.verdictSkip}>NO BID</Text>
      <Text style={styles.cardTitle}>Nothing worth sending</Text>
      <Text style={styles.reason}>{recommendation.reason}</Text>
      <Text style={styles.meta}>{recommendation.reviewed} listings reviewed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#10140F',
    paddingHorizontal: 20,
  },
  kicker: {
    color: '#C8F14A',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7EE',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
  },
  subtitle: {
    color: '#A8B39A',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#1C2618',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#C8F14A',
    fontSize: 12,
    fontWeight: '600',
  },
  refresh: {
    color: '#F4F7EE',
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    marginTop: 48,
  },
  card: {
    backgroundColor: '#181E16',
    borderRadius: 16,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verdictBid: {
    color: '#C8F14A',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  verdictSkip: {
    color: '#E8B86D',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  lane: {
    color: '#C8F14A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  posted: {
    color: '#8B9680',
    fontSize: 12,
  },
  cardTitle: {
    color: '#F4F7EE',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 6,
  },
  meta: {
    color: '#A8B39A',
    fontSize: 13,
    marginTop: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  score: {
    color: '#F4F7EE',
    fontSize: 13,
    fontWeight: '600',
  },
  reason: {
    color: '#D5DCCB',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  bidText: {
    color: '#F4F7EE',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#10140F',
  },
  cta: {
    backgroundColor: '#C8F14A',
    borderRadius: 12,
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#10140F',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryCta: {
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8F14A',
  },
  secondaryCtaText: {
    color: '#C8F14A',
    fontSize: 16,
    fontWeight: '700',
  },
  pipeline: {
    marginTop: 28,
  },
  pipelineTitle: {
    color: '#F4F7EE',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  pipelineCard: {
    backgroundColor: '#181E16',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pipelineJob: {
    color: '#F4F7EE',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6,
  },
});
