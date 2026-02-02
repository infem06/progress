
import { GoogleGenAI, Type } from "@google/genai";
import { Patient, Diagnosis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 5일치 치료 일지 일괄 생성
 * 요청하신 특정 양식(*제목, *상담내용)을 줄바꿈까지 포함하여 엄격히 준수합니다.
 */
export const generateFiveDayLogs = async (
  patient: Patient,
  activityInput: string,
  startDate: string
) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    당신은 16년차 베테랑 작업치료사입니다. 이용자 [${patient.name}]의 정보를 바탕으로 5일치 '치료활동일지'를 작성해주세요.

    [이용자 정보]
    - 진단명: ${patient.diagnosis}
    - 치료 목표: ${patient.goals.join(", ")}
    - 초기평가: ${patient.initialAssessment.substring(0, 100)}...

    [작성 양식 - 반드시 이 형식을 지키고 각 줄 끝에 줄바꿈(Enter)을 넣으세요]
    *제목
    1. (해당일 치료 내용 첫 번째 줄)
    2. (해당일 치료 내용 두 번째 줄)
    3. (해당일 치료 내용 세 번째 줄)
    4. (해당일 치료 내용 네 번째 줄)
    5. (해당일 치료 내용 다섯 번째 줄)

    *상담내용
    - (치료 내용에 대한 구체적인 상담 및 피드백 내용)

    [작성 규칙 - 중요!]
    1. 날짜는 ${startDate}부터 시작하여 평일(주말 제외) 기준으로 5일을 자동 계산할 것.
    2. 각 일지는 ${patient.goals.join(", ")} 중 '딱 하나의 목표'에만 집중하여 작성할 것.
    3. *제목 아래의 5줄은 반드시 각각 줄을 나누어 작성하여, 복사했을 때 바로 5행이 되어야 함.
    4. *제목 섹션과 *상담내용 섹션 사이에는 반드시 빈 줄(Enter 두 번)을 넣을 것.
    5. 문장 끝은 전문적인 개조식(~함, ~됨, ~임)으로 작성할 것.
    6. 입력된 키워드(${activityInput || '치료 관련 활동'})를 반영할 것.

    결과물은 반드시 지정된 JSON 형식으로만 출력하세요. content 필드 안의 텍스트에는 줄바꿈 문자(\\n)를 명확히 포함하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { 
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            logs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "YYYY-MM-DD 형식의 날짜" },
                  activityName: { type: Type.STRING, description: "해당 일의 주요 활동명" },
                  content: { type: Type.STRING, description: "줄바꿈(\\n)이 포함된 일지 내용 전체" }
                },
                required: ["date", "activityName", "content"]
              }
            }
          },
          required: ["logs"]
        }
      }
    });
    
    const result = JSON.parse(response.text);
    return result.logs as { date: string, activityName: string, content: string }[];
  } catch (error) {
    console.error("Gemini Multi-Log API Error:", error);
    throw new Error("5일치 일지 생성 중 오류가 발생했습니다.");
  }
};

export const generateInterimAssessment = async (
  initialAssessment: string,
  goals: string[],
  diagnosis: string
) => {
  const model = "gemini-3-flash-preview";
  const prompt = `작업치료사로서 중간평가를 작성하세요.\n진단: ${diagnosis}\n목표: ${goals.join(", ")}\n초기평가: ${initialAssessment}`;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  } catch (error) { throw new Error("중간평가 실패"); }
};

export const generateFinalAssessment = async (
  initialAssessment: string,
  interimAssessment: string,
  goals: string[],
  diagnosis: string
) => {
  const model = "gemini-3-flash-preview";
  const prompt = `작업치료사로서 종결평가를 작성하세요.\n진단: ${diagnosis}\n목표: ${goals.join(", ")}`;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
  } catch (error) { throw new Error("종결평가 실패"); }
};
