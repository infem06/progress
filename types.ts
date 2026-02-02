
export enum Diagnosis {
  ASD = '자폐스펙트럼',
  ADHD = '주의력결핍 과잉행동장애',
  ID = '지적장애',
  CP = '뇌병변',
  DD = '발달지연',
  PHYSICAL = '지체장애',
  LANGUAGE = '언어장애',
  VISUAL = '시각장애',
  OTHER = '기타'
}

export enum DisabilitySeverity {
  SEVERE = '심한 장애',
  NOT_SEVERE = '심하지 않은 장애'
}

export enum Gender {
  MALE = '남',
  FEMALE = '여'
}

export interface User {
  id: string;
  name: string;
  password: string;
}

export interface SuspensionRange {
  start: string;
  end: string;
}

export interface Patient {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string;
  diagnosis: Diagnosis;
  disabilitySeverity: DisabilitySeverity;
  goals: string[];
  initialAssessment: string; 
  initialAssessmentDate: string;
  interimAssessment: string; 
  interimAssessmentDate: string;
  finalAssessment: string;   
  finalAssessmentDate: string;
  therapyStartDate: string;
  suspensions: SuspensionRange[];
  terminationDate?: string;
}

export interface TherapyLog {
  id: string;
  patientId: string;
  date: string;
  activityName: string;
  generatedLog: string;
  reaction: string;
  createdAt: number;
}
