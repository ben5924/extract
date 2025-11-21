export interface AdEntity {
  id: string;
  ad_creation_time: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url: string;
  page_id: string;
  page_name: string;
  currency?: string;
  spend?: {
    lower_bound: string;
    upper_bound: string;
  };
  impressions?: {
    lower_bound: string;
    upper_bound: string;
  };
  demographic_distribution?: Array<{
    percentage: string;
    age: string;
    gender: string;
  }>;
  // In a real scraping scenario, these would be populated by the backend
  extracted_image_url?: string;
  extracted_video_url?: string;
}

export interface FacebookAPIResponse {
  data: AdEntity[];
  paging: {
    cursors: {
      before: string;
      after: string;
    };
    next: string;
  };
}

export interface AnalysisResult {
  summary: string;
  keyThemes: string[];
  targetAudience: string;
  toneOfVoice: string;
  recommendations: string;
}

export enum AppState {
  IDLE,
  LOADING_ADS,
  ADS_LOADED,
  ANALYZING,
  ERROR
}
