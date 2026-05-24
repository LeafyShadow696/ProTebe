import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "AI básník není nakonfigurovaný. Doplňte GEMINI_API_KEY v prostředí aplikace." },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "myshell-romance-app",
        },
      },
    });

    const { category, customInput } = await req.json();

    const dateMet = "3. dubna 2026"; // 3.4.2026

    let prompt = "";
    if (category === "poem") {
      prompt = `Napiš krátkou, hlubokou a upřímnou zamilovanou báseň v češtině pro Michaelku (mou milovanou přítelkyni). Potkali jsme se ${dateMet}. Báseň by měla vyjadřovat lásku, něhu, radost ze společně strávených dní a hloubku našich citů. Nepoužívej klišé, piš poeticky ale moderně a vkusně.`;
    } else if (category === "compliment") {
      prompt = `Napiš krásné, originální a upřímné vyznání lásky nebo kompliment v češtině pro Michaelku. Mělo by to být osobní, zahřát u srdce a ukázat jí, jak moc je pro mě výjimečná. Potkali jsme se ${dateMet}.`;
    } else if (category === "funny") {
      prompt = `Napiš krátký, vtipný a zároveň roztomilý zamilovaný vzkaz v češtině pro Michaelku. Spoj humor s romantikou tak, aby se usmála a cítila milovaná. Potkali jsme se ${dateMet}.`;
    } else {
      prompt = `Vytvoř zamilovaný vzkaz pro Michaelku v češtině na téma: "${customInput || 'naše společná láska'}". Zmiň, že se milujeme a potkali jsme se ${dateMet}. Buď kreativní a piš s citem a správnou diakritikou.`;
    }

    if (customInput && customInput.trim() !== "" && category !== "custom") {
      prompt += ` Přidej tam osobní detail: "${customInput}".`;
    }

    prompt += "\nOdpověď vrať čistě jako text, bez uvozovek na začátku a na konci, bez nadpisu, zformátované do pěkných odstavců nebo veršů.";

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.9,
      }
    });

    const resultText = response.text || "Nepodařilo se vygenerovat vzkaz. Zkus to prosím znovu.";

    return NextResponse.json({ text: resultText });
  } catch (error: any) {
    console.error("Gemini Poetry Generation Error:", error);
    return NextResponse.json(
      { error: "Omlouváme se, ale básník měl zrovna tvůrčí krizi. Zkuste to za chvilku znovu." },
      { status: 500 }
    );
  }
}
