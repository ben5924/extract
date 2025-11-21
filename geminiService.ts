import { GoogleGenAI, Type } from "@google/genai";
import { AdEntity, AnalysisResult } from '../types';

// Initialize Gemini Client
// Note: process.env.API_KEY is expected to be available in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeAdsStrategy = async (ads: AdEntity[]): Promise<AnalysisResult> => {
  if (!ads || ads.length === 0) {
    throw new Error("No ads provided for analysis");
  }

  // Prepare the data for the prompt. We minimize tokens by sending only text fields.
  const adsTextData = ads.map(ad => ({
    creation_date: ad.ad_creation_time,
    body: ad.ad_creative_bodies?.join(' ') || 'No body text',
    headline: ad.ad_creative_link_titles?.join(' ') || 'No headline',
    caption: ad.ad_creative_link_captions?.join(' ') || 'No caption',
    link_description: ad.ad_creative_link_descriptions?.join(' ') || 'No description',
  }));

  const prompt = `
    You are a world-class Marketing Strategist. Analyze the following JSON data representing active Facebook ads for a competitor.
    
    Ads Data:
    ${JSON.stringify(adsTextData)}

    Please provide a structured strategic analysis including:
    1. A high-level summary of their current campaign focus.
    2. Key recurring themes or value propositions (e.g., "Free Shipping", "Sustainability", "Discount focused").
    3. Inferred Target Audience based on the language and tone.
    4. The Tone of Voice (e.g., Urgent, Professional, Playful).
    5. Tactical Recommendations on how to counter or outperform these ads.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                keyThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
                targetAudience: { type: Type.STRING },
                toneOfVoice: { type: Type.STRING },
                recommendations: { type: Type.STRING }
            }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
        throw new Error("Empty response from Gemini");
    }

    return JSON.parse(resultText) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze ads with Gemini.");
  }
};
