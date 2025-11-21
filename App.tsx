import React, { useState, useCallback } from 'react';
import { AdEntity, AnalysisResult, AppState } from './types';
import { fetchCompetitorAds } from './services/facebookService';
import { analyzeAdsStrategy } from './services/geminiService';
import { AdCard } from './components/AdCard';
import { DashboardStats } from './components/DashboardStats';
import { AnalysisPanel } from './components/AnalysisPanel';
import { 
  Search, 
  Database, 
  Bot, 
  AlertCircle, 
  Layers, 
  ShieldAlert,
  Download
} from 'lucide-react';

const App: React.FC = () => {
  // Form State
  const [pageId, setPageId] = useState('9246289234'); // Default: La Redoute (from prompt)
  const [token, setToken] = useState('');
  const [country, setCountry] = useState('FR');

  // Data State
  const [ads, setAds] = useState<AdEntity[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ADS' | 'ANALYSIS'>('ADS');

  const handleFetchAds = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Pre-trim inputs to improve UX immediately
    const cleanToken = token.trim();
    const cleanPageId = pageId.trim();

    if (!cleanToken) {
      setErrorMsg("Please enter a valid Facebook Graph API Access Token.");
      return;
    }
    
    setErrorMsg(null);
    setAppState(AppState.LOADING_ADS);
    setAnalysis(null);

    try {
      // Service handles detailed sanitization
      const fetchedAds = await fetchCompetitorAds(cleanPageId, cleanToken, country);
      setAds(fetchedAds);
      setAppState(AppState.ADS_LOADED);
      setActiveTab('ADS');
    } catch (err: any) {
      setAppState(AppState.ERROR);
      setErrorMsg(err.message || "Failed to fetch ads");
    }
  }, [pageId, token, country]);

  const handleAnalyze = useCallback(async () => {
    if (ads.length === 0) return;

    setAppState(AppState.ANALYZING);
    setActiveTab('ANALYSIS');

    try {
      const result = await analyzeAdsStrategy(ads);
      setAnalysis(result);
      setAppState(AppState.ADS_LOADED); // Return to loaded state but with analysis ready
    } catch (err: any) {
      setAppState(AppState.ADS_LOADED); // Fallback
      setErrorMsg(err.message || "Analysis failed");
    }
  }, [ads]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
               <Layers className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">AdIntel<span className="text-indigo-500">.ai</span></h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
              <ShieldAlert className="w-3 h-3 mr-2 text-amber-500" />
              <span>Client-Side Demo Mode</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Config Panel */}
        <section className="mb-8 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleFetchAds} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">Page ID</label>
              <input
                type="text"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="e.g. 9246289234"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">Country</label>
                <select 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="FR">France</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                </select>
            </div>
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">
                Access Token <span className="text-slate-600 normal-case">(User Token with 'ads_read')</span>
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAG..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={appState === AppState.LOADING_ADS}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {appState === AppState.LOADING_ADS ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <Search className="w-4 h-4 mr-2" />
                        Fetch Ads
                    </>
                )}
              </button>
            </div>
          </form>
          
          {/* Error Display */}
          {errorMsg && (
            <div className="mt-4 p-3 bg-red-950/50 border border-red-900/50 text-red-200 rounded-lg flex items-start text-sm">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap">{errorMsg}</div>
            </div>
          )}
        </section>

        {/* Content Area */}
        {(ads.length > 0 || appState === AppState.ANALYZING) && (
          <div className="space-y-6">
            
            {/* Stats & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 self-start">
                    <button
                        onClick={() => setActiveTab('ADS')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center ${
                            activeTab === 'ADS' 
                            ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Database className="w-4 h-4 mr-2" />
                        Ad Grid
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('ANALYSIS');
                            if (!analysis && appState !== AppState.ANALYZING) {
                                handleAnalyze();
                            }
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center ${
                            activeTab === 'ANALYSIS' 
                            ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Bot className="w-4 h-4 mr-2" />
                        AI Strategy
                    </button>
                </div>

                {activeTab === 'ADS' && (
                    <div className="flex items-center space-x-2">
                         <button 
                             disabled
                             className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-500 text-sm cursor-not-allowed opacity-70"
                             title="Feature requires backend scraper"
                         >
                             <Download className="w-4 h-4 mr-2" />
                             Export Media
                         </button>
                         <button
                             onClick={handleAnalyze}
                             className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                         >
                             <Bot className="w-4 h-4 mr-2" />
                             Run Analysis
                         </button>
                    </div>
                )}
            </div>

            {/* Main View */}
            {activeTab === 'ADS' ? (
                <>
                    <DashboardStats ads={ads} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ads.map((ad) => (
                            <AdCard key={ad.id} ad={ad} />
                        ))}
                    </div>
                </>
            ) : (
                <AnalysisPanel analysis={analysis} isAnalyzing={appState === AppState.ANALYZING} />
            )}
            
          </div>
        )}

        {/* Empty State */}
        {ads.length === 0 && appState !== AppState.LOADING_ADS && !errorMsg && (
            <div className="text-center py-20 text-slate-500">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                    <Search className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-white">No Data Loaded</h3>
                <p className="max-w-md mx-auto mt-2">Enter a Facebook Page ID and a valid Access Token to start retrieving and analyzing competitor ads.</p>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;