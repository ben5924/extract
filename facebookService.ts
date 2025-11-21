import { AdEntity, FacebookAPIResponse } from '../types';

// Note: In a production environment, this call should be proxied through a backend
// to protect tokens and handle CORS properly. This implementation assumes a valid
// user access token with 'ads_read' permissions is provided by the user.

const BASE_URL = 'https://graph.facebook.com/v19.0';

export const fetchCompetitorAds = async (
  pageId: string,
  accessToken: string,
  country: string = 'FR'
): Promise<AdEntity[]> => {
  // Sanitize inputs aggressively to prevent "Expected 1 '.'" errors
  let cleanToken = accessToken.trim();
  
  // Remove "Bearer " prefix if copied from headers
  if (cleanToken.toLowerCase().startsWith('bearer ')) {
    cleanToken = cleanToken.slice(7).trim();
  }
  
  // Remove potential surrounding quotes
  cleanToken = cleanToken.replace(/^["']|["']$/g, '');

  const cleanPageId = pageId.trim();

  if (!cleanPageId || !cleanToken) {
    throw new Error('Page ID and Access Token are required');
  }

  // Fields to retrieve
  const fields = [
    'id',
    'ad_creation_time',
    'ad_creative_bodies',
    'ad_creative_link_captions',
    'ad_creative_link_titles',
    'ad_creative_link_descriptions',
    'ad_snapshot_url',
    'page_id',
    'page_name',
    // 'spend', // Requires extra permissions usually
    // 'impressions', // Requires extra permissions usually
    // 'demographic_distribution' // Requires extra permissions usually
  ].join(',');

  const params = new URLSearchParams({
    access_token: cleanToken,
    search_page_ids: cleanPageId,
    ad_active_status: 'ACTIVE',
    ad_reached_countries: `['${country}']`,
    fields: fields,
    limit: '25', // Fetch top 25 active ads
  });

  try {
    const response = await fetch(`${BASE_URL}/ads_archive?${params.toString()}`);
    
    const data = await response.json();

    if (!response.ok) {
      // Fix for [object Object] error logging
      console.error("FB API Error Details:", JSON.stringify(data, null, 2));
      
      const errorMsg = data.error?.message || data.error?.user_title;
      const errorType = data.error?.type;
      const errorCode = data.error?.code;
      
      throw new Error(
        errorMsg 
          ? `${errorMsg} (Code: ${errorCode})` 
          : 'Failed to fetch ads from Facebook API'
      );
    }

    return (data as FacebookAPIResponse).data;

  } catch (error: any) {
    console.error("Error fetching ads:", error);
    // Pass through the specific API error message if available
    throw new Error(error.message || "An unexpected error occurred while fetching ads.");
  }
};