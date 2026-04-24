import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY as string 
});

export const geminiModel = "gemini-3-flash-preview";

export const sendMessageToGemini = async (prompt: string, imageBase64?: string) => {
  try {
    const parts: any[] = [{ text: prompt }];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: { parts },
      config: {
        systemInstruction: "你是一位專業的旅遊助手，目前正陪伴使用者在沖繩旅行。你精通日文與中文，可以幫助使用者翻譯各種內容（如菜單、告示牌）、解釋文化、推薦景點與美食。雖然你對沖繩非常熟悉，但你也可以回答任何一般的旅遊問題、生活知識或進行一般對話。回答時請保持親切、專業且富有旅遊的愉快氛圍。",
      }
    });

    return response.text || "抱歉，我暫時無法回答這個問題。";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `連線 AI 服務時發生錯誤，請稍後再試。(${error?.message || '未知錯誤'})`;
  }
};
