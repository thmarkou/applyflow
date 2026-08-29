import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadJobs, sortJobs } from '../api/jobs';
import type { Job, JobLane } from '../types/job';

const LANE_LABEL: Record<JobLane, string> = {
  'react-native': 'React Native',
  'legacy-dotnet': '.NET / SQL',
  advisory: 'Advisory',
};

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [source, setSource] = useState<'mock' | 'upwork'>('mock');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const payload = await loadJobs();
    setSource(payload.source);
    setJobs(sortJobs(payload.jobs));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => jobs.find(job => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.kicker}>ApplyFlow</Text>
      <Text style={styles.title}>Job desk</Text>
      <Text style={styles.subtitle}>
        Senior / enterprise only. Mock feed until the Upwork key is enabled.
      </Text>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {source === 'upwork' ? 'Upwork live' : 'Mock data'}
          </Text>
        </View>
        <Pressable onPress={() => void refresh()} hitSlop={8}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#C8F14A" style={styles.loader} />
      ) : selected ? (
        <JobDetail job={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}>
          {jobs.map(job => (
            <Pressable
              key={job.id}
              style={styles.card}
              onPress={() => setSelectedId(job.id)}>
              <View style={styles.cardTop}>
                <Text style={styles.lane}>{LANE_LABEL[job.lane]}</Text>
                <Text style={styles.posted}>{formatPostedAt(job.postedAt)}</Text>
              </View>
              <Text style={styles.cardTitle}>{job.title}</Text>
              <Text style={styles.meta}>
                {job.budgetLabel} · {job.proposals} proposals ·{' '}
                {job.client.verifiedPayment ? 'Verified' : 'Unverified'}
              </Text>
              <View style={styles.scoreRow}>
                <Text style={styles.score}>Fit {job.fitScore}</Text>
                <Text style={styles.score}>Client {job.qualityScore}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function JobDetail({ job, onBack }: { job: Job; onBack: () => void }) {
  const shouldSkip = job.fitScore < 50 || job.qualityScore < 50;

  return (
    <ScrollView contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.back}>← Inbox</Text>
      </Pressable>
      <Text style={styles.lane}>{LANE_LABEL[job.lane]}</Text>
      <Text style={styles.detailTitle}>{job.title}</Text>
      <Text style={styles.meta}>
        {job.budgetLabel} · {job.client.name} · {job.client.hires} hires
      </Text>
      {shouldSkip ? (
        <Text style={styles.warn}>
          Skip by default: low fit or weak client signals.
        </Text>
      ) : null}
      <Text style={styles.body}>{job.description}</Text>
      <Pressable
        style={styles.cta}
        onPress={() => {
          void Linking.openURL(job.upworkUrl);
        }}>
        <Text style={styles.ctaText}>Open in Upwork</Text>
      </Pressable>
    </ScrollView>
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
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
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
  detail: {
    paddingBottom: 40,
  },
  back: {
    color: '#C8F14A',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailTitle: {
    color: '#F4F7EE',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
    lineHeight: 32,
  },
  body: {
    color: '#D5DCCB',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  warn: {
    color: '#E8B86D',
    fontSize: 14,
    marginTop: 12,
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
});
