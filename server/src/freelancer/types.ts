export type FreelancerProject = {
  id: number;
  title?: string;
  preview_description?: string;
  description?: string;
  type?: string;
  seo_url?: string;
  owner_id?: number;
  time_submitted?: number;
  budget?: {
    minimum?: number;
    maximum?: number;
  };
  bid_stats?: {
    bid_count?: number;
  };
};

export type FreelancerUser = {
  id?: number;
  display_name?: string;
  username?: string;
  status?: {
    payment_verified?: boolean;
  };
  location?: {
    country?: {
      code?: string;
      name?: string;
    };
  };
  employer_reputation?: {
    entire_history?: {
      overall?: number;
      reviews?: number;
    };
  };
};

export type FreelancerSearchResponse = {
  status?: string;
  message?: string;
  result?: {
    projects?: FreelancerProject[];
    users?: Record<string, FreelancerUser>;
  };
};
