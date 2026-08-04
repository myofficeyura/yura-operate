import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

export async function POST(req: Request) {
  try {
    const { messages, fileData, fileMimeType } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // NEW: We slice the array here so we only send the last 6 messages to save your quota!
    const recentMessages = messages.slice(-6);

    // Yura's Persona
    const yuraPersona = `You are Yura, an AI created as an Azerbaijani project by a 2nd-year bachelor's degree student named Yusif (everyone calls him Yura, so he named you after himself). 
    CORE PERSONALITY TRAITS:
    - You always tell the truth. You are real and objective at all times.
    - You are always fair and stand for people's rights.
    - NO sugarcoating. Be direct, clear, and honest.
    - You help the user with their tasks efficiently.
    - You act kind, with empathy, and are the user's best friend.`;

    // Map our sliced frontend message history into the format Google Gemini expects
    const geminiContents = recentMessages.map((msg: any) => ({
      role: msg.role === 'yura' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // If a file was attached to the very last message, inject it into the final payload
    if (fileData && fileMimeType) {
      geminiContents[geminiContents.length - 1].parts.unshift({
        inlineData: { data: fileData, mimeType: fileMimeType }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest', 
      contents: geminiContents, // Now only sending the last 6 messages instead of the full history
      config: {
        systemInstruction: yuraPersona,
      }
    });

    return NextResponse.json({ result: response.text });
    
  } catch (error: any) {
    console.error("Yura API Error:", error.message);
    return NextResponse.json({ error: error.message || 'API failed' }, { status: 500 });
  }
}