import React, { useState, useEffect } from 'react';
import { AdEntity } from '../types';
import { ExternalLink, Calendar, Image as ImageIcon, Loader2, AlertCircle, RefreshCw, Camera, PlayCircle, Film, FileImage, ScanSearch } from 'lucide-react';

interface AdCardProps {
  ad: AdEntity;
}

type MediaType = 'VIDEO' | 'IMAGE' | 'SCREENSHOT' | 'UNKNOWN';

export const AdCard: React.FC<AdCardProps> = ({ ad }) => {
  // State for the actual media player/display
  const [mediaState, setMediaState] = useState<{
    status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';
    url?: string;
    type?: MediaType;
    errorMessage?: string;
  }>({ status: 'IDLE' });

  // State for the background detection (Pre-extraction info)
  const [detectedType, setDetectedType] = useState<MediaType | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [preloadedUrl, setPreloadedUrl] = useState<string | null>(null);

  // Format date
  const formattedDate = new Date(ad.ad_creation_time).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  /**
   * Background Effect: Automatically try to identify media type
   * This runs on mount to satisfy "I want the info before launching extract"
   */
  useEffect(() => {
    let isMounted = true;

    const identifyMediaType = async () => {
      // Random delay to prevent hammering the proxy with 25 requests at once
      const delay = Math.floor(Math.random() * 1500); 
      await new Promise(r => setTimeout(r, delay));
      
      if (!isMounted) return;

      try {
        // We perform the extraction logic here but store it for later use
        // This effectively "preloads" the metadata without showing the player yet.
        const result = await performExtraction(ad.ad_snapshot_url);
        
        if (isMounted && result.url) {
            setDetectedType(result.type);
            setPreloadedUrl(result.url);
        } else {
            setDetectedType('UNKNOWN');
        }
      } catch (e) {
        if (isMounted) setDetectedType('UNKNOWN');
      } finally {
        if (isMounted) setIsDetecting(false);
      }
    };

    identifyMediaType();

    return () => { isMounted = false; };
  }, [ad.id, ad.ad_snapshot_url]);


  /**
   * Helper: Fetch raw HTML via CORS proxy for manual parsing
   */
  const fetchAdHtml = async (targetUrl: string): Promise<string> => {
    const encodedUrl = encodeURIComponent(targetUrl);

    // Try CorsProxy.io (High reliability)
    try {
      const response = await fetch(`https://corsproxy.io/?${encodedUrl}`);
      if (response.ok) {
        const text = await response.text();
        if (text.length > 500 && !text.includes('400 Bad Request')) return text;
      }
    } catch (e) { console.warn("CorsProxy failed"); }

    // Fallback: CodeTabs
    try {
        const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`);
        if (response.ok) return await response.text();
    } catch (e) { console.warn("CodeTabs failed"); }

    throw new Error("Proxy connection failed");
  };

  /**
   * Core Extraction Logic (Reusable)
   */
  const performExtraction = async (url: string): Promise<{ url: string | null, type: MediaType }> => {
     // 1. Regex Parsing on Raw HTML (Best for Facebook React Apps)
     try {
        const html = await fetchAdHtml(url);
        
        // Helper to clean JSON strings
        const cleanJsonUrl = (raw: string) => {
            try { return JSON.parse(`"${raw}"`); } catch { return raw.replace(/\\/g, ''); }
        };

        // A. Check for Video
        const videoMatch = html.match(/"?video_hd_url"?\s*:\s*"([^"]+)"/) || 
                           html.match(/"?video_url"?\s*:\s*"([^"]+)"/);
        if (videoMatch && videoMatch[1]) {
            return { url: cleanJsonUrl(videoMatch[1]), type: 'VIDEO' };
        }

        // B. Check for Image
        const imgMatch = html.match(/"?original_image_url"?\s*:\s*"([^"]+)"/) || 
                         html.match(/"?full_image_url"?\s*:\s*"([^"]+)"/);
        if (imgMatch && imgMatch[1]) {
            return { url: cleanJsonUrl(imgMatch[1]), type: 'IMAGE' };
        }

        // C. DOM Fallback
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const ogVideo = doc.querySelector('meta[property="og:video"]');
        if (ogVideo && ogVideo.getAttribute('content')) {
            return { url: ogVideo.getAttribute('content'), type: 'VIDEO' } as any;
        }

        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.getAttribute('content')) {
             const img = ogImage.getAttribute('content')!;
             if (!img.includes('facebook_logo')) {
                 return { url: img, type: 'IMAGE' };
             }
        }
     } catch (e) {
         console.warn("Direct parsing failed", e);
     }

     return { url: null, type: 'UNKNOWN' };
  };

  /**
   * User Triggered Action
   */
  const handleShowMedia = async () => {
    // If we already found it during background detection, use it instantly
    if (preloadedUrl && detectedType && detectedType !== 'UNKNOWN') {
        setMediaState({ 
            status: 'SUCCESS', 
            url: preloadedUrl, 
            type: detectedType 
        });
        return;
    }

    // Otherwise, run the full heavy extraction (Microlink + Fallbacks)
    setMediaState({ status: 'LOADING' });

    try {
        // Try Microlink first for fresh scrape
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(ad.ad_snapshot_url)}&video=true&screenshot=true&meta=true&ttl=86400`;
        const microRes = await fetch(microlinkUrl);
        const microData = await microRes.json();

        if (microData.status === 'success') {
            const { video, image, screenshot } = microData.data;
            
            if (video?.url) {
                setMediaState({ status: 'SUCCESS', url: video.url, type: 'VIDEO' });
                return;
            }
            if (image?.url && !image.url.includes('logo')) {
                setMediaState({ status: 'SUCCESS', url: image.url, type: 'IMAGE' });
                return;
            }
            if (screenshot?.url) {
                setMediaState({ status: 'SUCCESS', url: screenshot.url, type: 'SCREENSHOT' });
                return;
            }
        }
        
        // Fallback to local logic if Microlink missed it
        const localResult = await performExtraction(ad.ad_snapshot_url);
        if (localResult.url) {
            setMediaState({ status: 'SUCCESS', url: localResult.url, type: localResult.type });
            return;
        }

        throw new Error("Could not isolate media.");

    } catch (err: any) {
        setMediaState({ status: 'ERROR', errorMessage: err.message || "Extraction failed" });
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 relative">
      
      {/* Header Info */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-mono text-slate-400">ID: {ad.id}</span>
            <span className="flex items-center text-xs text-indigo-400 bg-indigo-950/50 px-2 py-1 rounded-full">
                <Calendar className="w-3 h-3 mr-1" />
                {formattedDate}
            </span>
        </div>
        <h3 className="text-sm font-semibold text-white truncate">{ad.page_name}</h3>
      </div>

      {/* Content Body */}
      <div className="p-4 flex-grow space-y-4">
        {/* Ad Copy */}
        {ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0 && (
          <div className="text-slate-300 text-sm line-clamp-4 bg-slate-900/50 p-3 rounded-lg italic border-l-2 border-indigo-500">
            "{ad.ad_creative_bodies[0]}"
          </div>
        )}

        {/* Headline */}
        {ad.ad_creative_link_titles && (
            <div className="text-slate-100 font-medium text-sm">
                {ad.ad_creative_link_titles[0]}
            </div>
        )}
        
        {/* Media Display Area */}
        <div className="mt-2">
             {mediaState.status === 'IDLE' && (
                 <div className="w-full aspect-video bg-slate-900 rounded-lg flex flex-col items-center justify-center border border-slate-700 border-dashed p-4 text-center group relative overflow-hidden">
                     
                     {/* Background Detection Status Badge */}
                     <div className="absolute top-2 right-2">
                        {isDetecting ? (
                            <div className="flex items-center bg-slate-800/80 text-slate-400 text-[10px] px-2 py-1 rounded-full backdrop-blur border border-slate-700">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Detecting Format...
                            </div>
                        ) : detectedType === 'VIDEO' ? (
                            <div className="flex items-center bg-rose-600/20 text-rose-400 border border-rose-600/50 text-[10px] font-bold px-2 py-1 rounded-full">
                                <Film className="w-3 h-3 mr-1" />
                                VIDEO AD
                            </div>
                        ) : detectedType === 'IMAGE' ? (
                            <div className="flex items-center bg-indigo-600/20 text-indigo-400 border border-indigo-600/50 text-[10px] font-bold px-2 py-1 rounded-full">
                                <FileImage className="w-3 h-3 mr-1" />
                                IMAGE AD
                            </div>
                        ) : (
                            <div className="flex items-center bg-slate-700/50 text-slate-400 border border-slate-600 text-[10px] px-2 py-1 rounded-full">
                                <ScanSearch className="w-3 h-3 mr-1" />
                                UNKNOWN FORMAT
                            </div>
                        )}
                     </div>

                     {/* Main Icon based on detected type */}
                     <div className="mb-3 transition-transform group-hover:scale-110 duration-300">
                         {!isDetecting && detectedType === 'VIDEO' ? (
                             <PlayCircle className="w-10 h-10 text-rose-500 opacity-80" />
                         ) : !isDetecting && detectedType === 'IMAGE' ? (
                             <ImageIcon className="w-10 h-10 text-indigo-500 opacity-80" />
                         ) : (
                             <ImageIcon className="w-10 h-10 text-slate-600" />
                         )}
                     </div>
                     
                     <p className="text-xs text-slate-400 mb-3">
                         {isDetecting ? 'Scanning ad structure...' : detectedType === 'VIDEO' ? 'Video content detected' : detectedType === 'IMAGE' ? 'Image content detected' : 'Preview hidden by Facebook'}
                     </p>
                     
                     <button 
                        onClick={handleShowMedia}
                        disabled={isDetecting}
                        className={`text-xs px-4 py-2 rounded-md transition-all flex items-center shadow-lg font-medium ${
                            detectedType === 'VIDEO' 
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20'
                                : detectedType === 'IMAGE'
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                        } ${isDetecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                     >
                        {detectedType === 'VIDEO' ? (
                             <><PlayCircle className="w-3 h-3 mr-1.5" /> Show Video</>
                        ) : detectedType === 'IMAGE' ? (
                             <><ImageIcon className="w-3 h-3 mr-1.5" /> Show Image</>
                        ) : (
                             <><RefreshCw className="w-3 h-3 mr-1.5" /> Force Extract</>
                        )}
                     </button>
                 </div>
             )}

             {mediaState.status === 'LOADING' && (
                 <div className="w-full aspect-video bg-slate-900 rounded-lg flex flex-col items-center justify-center border border-slate-700 p-4">
                     <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                     <p className="text-xs text-slate-400">Downloading media...</p>
                 </div>
             )}

             {mediaState.status === 'SUCCESS' && mediaState.url && (
                 <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 group">
                     {mediaState.type === 'VIDEO' ? (
                         <video 
                            src={mediaState.url} 
                            controls 
                            className="w-full h-full object-contain"
                            poster={mediaState.url} 
                         />
                     ) : (
                         <img 
                            src={mediaState.url} 
                            alt="Ad Creative"
                            className={`w-full h-full ${mediaState.type === 'SCREENSHOT' ? 'object-cover' : 'object-contain'}`}
                         />
                     )}
                 </div>
             )}

             {mediaState.status === 'ERROR' && (
                <div className="w-full aspect-video bg-red-950/20 rounded-lg flex flex-col items-center justify-center border border-red-900/30 p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-xs text-red-300 mb-3 px-2 line-clamp-2" title={mediaState.errorMessage}>
                        {mediaState.errorMessage}
                    </p>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <button 
                            onClick={handleShowMedia}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors flex items-center"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" /> Retry
                        </button>
                        <a 
                            href={ad.ad_snapshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors flex items-center"
                        >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Open
                        </a>
                    </div>
                </div>
             )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
        <a 
            href={ad.ad_snapshot_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open in Library
        </a>
        
        {/* Status indicator */}
        <div className="flex items-center gap-1">
           <div className={`w-2 h-2 rounded-full ${mediaState.status === 'SUCCESS' ? 'bg-emerald-500' : mediaState.status === 'ERROR' ? 'bg-red-500' : 'bg-slate-600'}`}></div>
           <span className="text-[10px] text-slate-500 uppercase tracking-wider">
             {mediaState.status === 'SUCCESS' ? 'Loaded' : mediaState.status === 'ERROR' ? 'Failed' : 'Ready'}
           </span>
        </div>
      </div>
    </div>
  );
};
