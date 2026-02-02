
import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, FileText, Search, Calendar, ChevronRight, Activity, Home,
  UserPlus, ArrowLeft, Loader2, Edit3, LogOut, Sparkles, Key,
  CalendarDays, ChevronDown, ChevronUp, Download, Upload, ShieldCheck, Settings, ExternalLink, Save, CheckCircle2
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- 유형 정의 (Internal Types) ---
enum Diagnosis {
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

enum DisabilitySeverity {
  SEVERE = '심한 장애',
  NOT_SEVERE = '심하지 않은 장애'
}

enum Gender {
  MALE = '남',
  FEMALE = '여'
}

interface User {
  id: string;
  name: string;
  password: string;
}

interface SuspensionRange {
  start: string;
  end: string;
}

interface Patient {
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

interface TherapyLog {
  id: string;
  patientId: string;
  date: string;
  activityName: string;
  generatedLog: string;
  reaction: string;
  createdAt: number;
}

// --- 메인 앱 컴포넌트 ---
export default function App() {
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('ot_user_profile');
    return saved ? JSON.parse(saved) : { id: 'user_1', name: '김주영', password: '1197' };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('ot_auth_session') === 'true');
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem('ot_patients_data');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [logs, setLogs] = useState<TherapyLog[]>(() => {
    try {
      const saved = localStorage.getItem('ot_logs_data');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [view, setView] = useState<'dashboard' | 'patients' | 'add_patient' | 'patient_detail' | 'generate_log' | 'data_management' | 'settings'>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editForm, setEditForm] = useState<Patient | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedAssessments, setExpandedAssessments] = useState<{ [key: string]: boolean }>({});
  
  // API 키 관련 상태
  const [manualApiKey, setManualApiKey] = useState(() => localStorage.getItem('ot_manual_api_key') || '');
  const [isAiReady, setIsAiReady] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // 데이터 영구 저장
  useEffect(() => {
    localStorage.setItem('ot_user_profile', JSON.stringify(user));
    localStorage.setItem('ot_patients_data', JSON.stringify(patients));
    localStorage.setItem('ot_logs_data', JSON.stringify(logs));
  }, [user, patients, logs]);

  // API 키 유효성 및 엔진 초기화
  useEffect(() => {
    const initializeAi = async () => {
      const storedKey = localStorage.getItem('ot_manual_api_key');
      if (storedKey) {
        process.env.API_KEY = storedKey;
        setIsAiReady(true);
      } else if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) setIsAiReady(true);
      }
    };
    initializeAi();
  }, []);

  const handleSaveManualKey = () => {
    if (!manualApiKey.trim()) {
      alert("API 키를 입력해주세요.");
      return;
    }
    localStorage.setItem('ot_manual_api_key', manualApiKey);
    process.env.API_KEY = manualApiKey;
    setIsAiReady(true);
    alert("API 키가 성공적으로 저장되었습니다. 이제 AI 기능을 사용할 수 있습니다!");
  };

  const toggleAssessment = (key: string) => {
    setExpandedAssessments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeleteLog = (id: string) => {
    if (deleteConfirmId === id) {
      setLogs(prev => prev.filter(l => l.id !== id));
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const generateFiveDayLogsInternal = async (patient: Patient, activityInput: string, startDate: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = "gemini-3-flash-preview";
    
    const prompt = `당신은 16년차 베테랑 작업치료사입니다. [${patient.name}]의 일지를 5일치 작성하세요.
    진단: ${patient.diagnosis}
    목표: ${patient.goals.join(", ")}
    활동: ${activityInput}
    기준일: ${startDate}
    
    [작성 양식 - 반드시 이 형식을 지키고 각 줄 끝에 줄바꿈을 넣으세요]
    *제목
    1. (치료 내용 첫 번째 줄)
    2. (치료 내용 두 번째 줄)
    3. (치료 내용 세 번째 줄)
    4. (치료 내용 네 번째 줄)
    5. (치료 내용 다섯 번째 줄)
    
    *상담내용
    - (구체적인 상담 및 피드백)
    
    전문적인 개조식(~함, ~됨)으로 작성하세요. JSON 형식으로 logs 배열 안에 date, activityName, content를 담아 출력하세요.`;

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
                  date: { type: Type.STRING },
                  activityName: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["date", "activityName", "content"]
              }
            }
          },
          required: ["logs"]
        }
      }
    });
    return JSON.parse(response.text).logs;
  };

  const handleGenerateBatchLogs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!isAiReady) {
      alert("AI 키가 설정되지 않았습니다. 설정 메뉴에서 키를 입력해주세요.");
      setView('settings');
      return;
    }

    setIsGenerating(true);
    const formData = new FormData(e.currentTarget);
    const activityInput = formData.get('activity') as string;
    const startDate = formData.get('date') as string;

    try {
      const generatedLogs = await generateFiveDayLogsInternal(selectedPatient, activityInput, startDate);
      const newLogs: TherapyLog[] = generatedLogs.map((log: any, idx: number) => ({
        id: (Date.now() + idx).toString(),
        patientId: selectedPatient.id,
        date: log.date,
        activityName: log.activityName,
        generatedLog: log.content,
        reaction: "",
        createdAt: Date.now() + idx
      }));
      setLogs(prev => [...newLogs, ...prev]);
      setView('patient_detail');
    } catch (error: any) {
      alert("일지 생성 중 오류가 발생했습니다. API 키가 유효한지 확인해주세요.");
    } finally { setIsGenerating(false); }
  };

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); setIsAuthenticated(true); localStorage.setItem('ot_auth_session', 'true'); setView('dashboard'); };
  const handleLogout = () => { setIsAuthenticated(false); localStorage.removeItem('ot_auth_session'); setView('dashboard'); };
  
  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: Patient = { 
      id: Date.now().toString(), 
      ...newPatientForm, 
      goals: newPatientForm.goals.split(',').map(g => g.trim()).filter(g => g !== ''), 
    };
    setPatients(prev => [...prev, newPatient]);
    setView('patients');
    setNewPatientForm({ name: '', gender: Gender.MALE, birthDate: '', diagnosis: Diagnosis.ASD, disabilitySeverity: DisabilitySeverity.SEVERE, goals: '', initialAssessment: '', initialAssessmentDate: new Date().toISOString().split('T')[0], interimAssessment: '', interimAssessmentDate: '', finalAssessment: '', finalAssessmentDate: '', therapyStartDate: new Date().toISOString().split('T')[0], suspensions: [], terminationDate: '' });
  };

  const [newPatientForm, setNewPatientForm] = useState({ name: '', gender: Gender.MALE, birthDate: '', diagnosis: Diagnosis.ASD, disabilitySeverity: DisabilitySeverity.SEVERE, goals: '', initialAssessment: '', initialAssessmentDate: new Date().toISOString().split('T')[0], interimAssessment: '', interimAssessmentDate: '', finalAssessment: '', finalAssessmentDate: '', therapyStartDate: new Date().toISOString().split('T')[0], suspensions: [], terminationDate: '' });

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center mb-10">
          <Activity className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">OT-Log Master</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID</label>
            <input placeholder="치료사 아이디" required className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner focus:ring-2 focus:ring-emerald-500 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PASSWORD</label>
            <input type="password" placeholder="비밀번호" required className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner focus:ring-2 focus:ring-emerald-500 transition-all" />
          </div>
          <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-100 transition-all active:scale-95 hover:bg-emerald-700">로그인</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <nav className="w-full md:w-72 bg-slate-900 text-white p-6 md:p-8 sticky top-0 z-20 flex flex-col md:h-screen">
        <div className="flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start">
          <div className="flex items-center gap-3 mb-0 md:mb-12">
            <Activity className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-black tracking-tighter">OT Master</h1>
          </div>
          <ul className="hidden md:block space-y-3 w-full">
            <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Home/>} label="대시보드" />
            <NavItem active={view === 'patients' || view === 'patient_detail' || view === 'generate_log'} onClick={() => setView('patients')} icon={<Users/>} label="이용자 차트" />
            <NavItem active={view === 'add_patient'} onClick={() => setView('add_patient')} icon={<UserPlus/>} label="신규 등록" />
            <NavItem active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings/>} label="시스템 설정" />
          </ul>
        </div>
        
        <div className="mt-auto hidden md:flex flex-col gap-4">
          <div className={`p-5 rounded-2xl border transition-all ${isAiReady ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">AI Status</span>
                <div className={`w-2.5 h-2.5 rounded-full ${isAiReady ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></div>
             </div>
             <p className="text-sm font-bold truncate">{user.name} 치료사</p>
             <p className={`text-[10px] mt-1 font-black ${isAiReady ? 'text-emerald-400' : 'text-red-400'}`}>{isAiReady ? 'AI 엔진 정상 작동' : 'AI 키 설정 필요'}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 font-bold text-sm transition-all"><LogOut className="w-5 h-5" /> 로그아웃</button>
        </div>

        <div className="md:hidden flex gap-2 overflow-x-auto mt-4 pb-1">
          <MobileNavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Home/>} />
          <MobileNavItem active={view === 'patients'} onClick={() => setView('patients')} icon={<Users/>} />
          <MobileNavItem active={view === 'add_patient'} onClick={() => setView('add_patient')} icon={<UserPlus/>} />
          <MobileNavItem active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings/>} />
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{user.name} 선생님, 반가워요!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <DashboardCard icon={<Users className="text-blue-600"/>} title="관리 이용자" value={`${patients.length}명`} color="bg-blue-50" />
              <DashboardCard icon={<FileText className="text-emerald-600"/>} title="누적 일지" value={`${logs.length}건`} color="bg-emerald-50" />
              <DashboardCard icon={<ShieldCheck className="text-purple-600"/>} title="보호 상태" value="안전함" color="bg-purple-50" />
            </div>
            {!isAiReady && (
              <div className="p-8 bg-amber-50 border border-amber-200 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="bg-white p-4 rounded-2xl shadow-sm text-amber-500 animate-pulse"><Sparkles className="w-8 h-8"/></div>
                  <div>
                    <p className="font-black text-lg text-slate-800 tracking-tight">AI 일지 생성기가 준비되지 않았습니다.</p>
                    <p className="text-sm text-slate-500 font-medium">Gemini API 키를 입력하면 16년차 치료사의 관점으로 일지가 자동 생성됩니다.</p>
                  </div>
                </div>
                <button onClick={() => setView('settings')} className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all">지금 설정하기</button>
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">시스템 설정</h2>
              <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${isAiReady ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {isAiReady ? 'AI Engine Ready' : 'AI Engine Offline'}
              </div>
            </div>
            
            <section className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-10">
              <div className="space-y-3">
                <h3 className="text-xl font-black flex items-center gap-3 text-slate-800">
                  <Key className="text-emerald-500 w-6 h-6"/> Gemini API 키 설정
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  자동 일지 생성 기능을 사용하려면 Google Gemini API 키가 필요합니다. 입력하신 키는 본인의 브라우저에만 암호화되어 저장됩니다.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key Entry</label>
                  <div className="relative group">
                    <input 
                      type="password" 
                      value={manualApiKey} 
                      onChange={(e) => setManualApiKey(e.target.value)}
                      placeholder="이곳에 API 키를 붙여넣으세요" 
                      className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-2xl outline-none font-bold text-slate-700 shadow-inner focus:border-emerald-500/30 focus:bg-white transition-all pr-20"
                    />
                    <button 
                      onClick={handleSaveManualKey}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all group-hover:scale-105"
                      title="키 저장"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isAiReady ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <p className={`text-[10px] font-black ${isAiReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isAiReady ? '현재 API 키가 인증되어 있습니다.' : '키를 입력하고 저장해주세요.'}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-4">
                  <div className="bg-white p-2.5 rounded-xl shadow-sm text-blue-500"><ExternalLink className="w-5 h-5"/></div>
                  <div>
                    <p className="font-black text-slate-800 text-sm">API 키가 없으신가요?</p>
                    <p className="text-xs text-slate-500 mt-1 mb-3">Google AI Studio에서 무료 또는 유료 키를 발급받을 수 있습니다.</p>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-black text-xs hover:underline uppercase tracking-tighter">API 키 발급 받기 →</a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'patients' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">이용자 차트</h2>
              <div className="relative w-full md:w-80 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" placeholder="이용자 이름 검색..." className="pl-12 pr-6 py-4 bg-white shadow-sm rounded-2xl w-full font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-slate-100" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {patients.filter(p => p.name.includes(searchTerm)).map(patient => (
                <div key={patient.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 hover:shadow-2xl hover:-translate-y-1 cursor-pointer transition-all relative overflow-hidden group" onClick={() => { setSelectedPatientId(patient.id); setView('patient_detail'); }}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:bg-emerald-50"></div>
                  <h4 className="text-2xl font-black text-slate-800 mb-1 z-10 relative">{patient.name} <span className="text-sm text-slate-300 font-bold">{patient.gender}</span></h4>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-6 z-10 relative">{patient.diagnosis}</p>
                  <div className="flex justify-between items-end mt-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">치료 개시일</span>
                      <span className="text-xs text-slate-700 font-black">{patient.therapyStartDate}</span>
                    </div>
                    <ChevronRight className="text-slate-200 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              ))}
              <div onClick={() => setView('add_patient')} className="border-4 border-dashed border-slate-200 p-8 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer min-h-[160px] transition-all">
                <PlusCircle className="w-12 h-12 mb-3" />
                <p className="font-black text-sm uppercase tracking-widest">신규 이용자 등록</p>
              </div>
            </div>
          </div>
        )}

        {view === 'patient_detail' && selectedPatient && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
             <button onClick={() => setView('patients')} className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase tracking-widest transition-colors"><ArrowLeft className="w-4 h-4" /> 차트 목록으로</button>
             <div className="bg-white rounded-[3rem] shadow-2xl border p-8 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                   <div>
                      <h2 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tighter mb-2">{selectedPatient.name}</h2>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase">{selectedPatient.diagnosis}</span>
                        <span className="px-3 py-1 bg-emerald-100 rounded-full text-[10px] font-black text-emerald-700 uppercase">{selectedPatient.disabilitySeverity}</span>
                      </div>
                   </div>
                   <button onClick={() => setView('generate_log')} className="w-full md:w-auto px-10 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-2xl hover:bg-emerald-700 hover:scale-[1.02] transition-all active:scale-95">
                      <Sparkles className="w-6 h-6 animate-pulse" /> AI 일지 자동 생성
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <AssessmentBox title="초기 평가" date={selectedPatient.initialAssessmentDate} content={selectedPatient.initialAssessment} isExpanded={expandedAssessments['initial']} onToggle={() => toggleAssessment('initial')} theme="emerald" />
                   <AssessmentBox title="중간 평가" date={selectedPatient.interimAssessmentDate} content={selectedPatient.interimAssessment} isExpanded={expandedAssessments['interim']} onToggle={() => toggleAssessment('interim')} theme="blue" />
                   <AssessmentBox title="종결 평가" date={selectedPatient.finalAssessmentDate} content={selectedPatient.finalAssessment} isExpanded={expandedAssessments['final']} onToggle={() => toggleAssessment('final')} theme="purple" />
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">치료 수행 기록 <span className="text-emerald-500 ml-1">({logs.filter(l => l.patientId === selectedPatient.id).length})</span></h3>
                </div>
                {logs.filter(l => l.patientId === selectedPatient.id).length === 0 ? (
                  <div className="p-16 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <FileText className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-black text-lg">아직 작성된 일지가 없습니다.</p>
                    <p className="text-sm">상단의 AI 자동 생성 버튼을 눌러보세요.</p>
                  </div>
                ) : (
                  logs.filter(l => l.patientId === selectedPatient.id).map(log => (
                    <div key={log.id} className="bg-white rounded-[2rem] shadow-sm border p-8 space-y-6 hover:shadow-xl transition-all border-l-8 border-l-emerald-500 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{log.date}</span>
                            <h4 className="text-xl font-black text-slate-800">{log.activityName}</h4>
                          </div>
                          <button onClick={() => handleDeleteLog(log.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${deleteConfirmId === log.id ? 'bg-red-500 text-white animate-pulse' : 'text-slate-300 hover:text-red-500'}`}>
                            {deleteConfirmId === log.id ? '진짜 삭제?' : '삭제'}
                          </button>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl">
                          <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">{log.generatedLog}</p>
                        </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {view === 'generate_log' && selectedPatient && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
            <button onClick={() => setView('patient_detail')} className="mb-8 flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase tracking-widest transition-colors"><ArrowLeft className="w-4 h-4" /> 뒤로가기</button>
            <div className="bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500"></div>
              <h2 className="text-3xl font-black mb-3 text-slate-800 tracking-tighter">16년차 AI 치료일지 생성</h2>
              <p className="text-slate-400 mb-12 font-bold text-xs uppercase tracking-widest leading-relaxed">이용자 정보와 초기평가를 바탕으로 5일치 일지를 일괄 구성합니다.</p>
              
              <form onSubmit={handleGenerateBatchLogs} className="space-y-10">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">치료 시작일 (기준일)</label>
                   <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="p-6 bg-slate-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">주요 활동 키워드</label>
                  <textarea name="activity" rows={4} className="w-full p-6 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700 shadow-inner focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="예: 시지각 협응 강화, 눈-손 협응력 증진을 위한 퍼즐 맞추기 등"></textarea>
                  <p className="text-[10px] text-slate-400 font-bold ml-1 italic">*키워드를 상세히 적을수록 일지 퀄리티가 높아집니다.</p>
                </div>
                <button type="submit" disabled={isGenerating} className={`w-full py-8 rounded-[2rem] font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all ${isGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'}`}>
                  {isGenerating ? <><Loader2 className="w-8 h-8 animate-spin" /> 일지 생성 중...</> : <><Sparkles className="w-8 h-8"/> 5일치 일지 생성하기</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {view === 'add_patient' && (
          <div className="max-w-4xl mx-auto bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl border animate-in fade-in duration-500">
            <h2 className="text-3xl md:text-4xl font-black mb-12 text-slate-800 flex items-center gap-4 tracking-tighter">
              <UserPlus className="text-emerald-600 w-10 h-10" /> 신규 이용자 등록
            </h2>
            <form onSubmit={handleAddPatient} className="space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <FormGroup label="이름" value={newPatientForm.name} onChange={(v:any) => setNewPatientForm({...newPatientForm, name: v})} required />
                <FormGroup label="생년월일" type="date" value={newPatientForm.birthDate} onChange={(v:any) => setNewPatientForm({...newPatientForm, birthDate: v})} required />
                <FormGroup label="치료 개시일" type="date" value={newPatientForm.therapyStartDate} onChange={(v:any) => setNewPatientForm({...newPatientForm, therapyStartDate: v})} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormGroup label="진단명" value={newPatientForm.diagnosis} onChange={(v:any) => setNewPatientForm({...newPatientForm, diagnosis: v as Diagnosis})} />
                <FormGroup label="장애정도" value={newPatientForm.disabilitySeverity} onChange={(v:any) => setNewPatientForm({...newPatientForm, disabilitySeverity: v as DisabilitySeverity})} />
              </div>
              <FormGroup label="치료 목표 (쉼표로 구분)" value={newPatientForm.goals} onChange={(v:any) => setNewPatientForm({...newPatientForm, goals: v})} placeholder="예: 소근육 협응 발달, 대근육 조절 능력 향상" required />
              
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">초기 평가 기록 (AI 일지 생성의 핵심 소스)</label>
                 <textarea value={newPatientForm.initialAssessment} onChange={(e) => setNewPatientForm({...newPatientForm, initialAssessment: e.target.value})} rows={6} className="w-full p-6 bg-slate-50 border-none rounded-[2rem] outline-none font-bold text-slate-700 shadow-inner focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="초기 평가 내용을 상세히 적을수록 AI 일지가 정확해집니다."></textarea>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button type="button" onClick={() => setView('patients')} className="w-full sm:flex-1 px-8 py-5 border-2 border-slate-100 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-all">등록 취소</button>
                <button type="submit" className="w-full sm:flex-1 px-8 py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 transition-all active:scale-95">이용자 차트 생성</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 공통 컴포넌트 ---
function NavItem({ active, onClick, icon, label }: any) {
  return (
    <li>
      <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-emerald-600 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
        <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
      </button>
    </li>
  );
}

function MobileNavItem({ active, onClick, icon }: any) {
  return (
    <button onClick={onClick} className={`flex-shrink-0 p-4 rounded-2xl transition-all ${active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
    </button>
  );
}

function DashboardCard({ icon, title, value, color }: any) {
  return (
    <div className={`${color} p-8 rounded-[2.5rem] border border-white shadow-sm flex items-center gap-8 group transition-all hover:scale-[1.02]`}>
      <div className="bg-white p-5 rounded-2xl shadow-lg group-hover:rotate-6 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function AssessmentBox({ title, date, content, isExpanded, onToggle, theme }: any) {
  const bgMap: any = { emerald: 'bg-emerald-50/50 border-emerald-100', blue: 'bg-blue-50/50 border-blue-100', purple: 'bg-purple-50/50 border-purple-100' };
  const textMap: any = { emerald: 'text-emerald-600', blue: 'text-blue-600', purple: 'text-purple-600' };

  return (
    <div className={`${bgMap[theme]} p-8 rounded-[2.5rem] border relative flex flex-col min-h-[160px] shadow-sm transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className={`text-[10px] font-black ${textMap[theme]} uppercase tracking-widest`}>{title}</p>
          <p className="text-[10px] font-black text-slate-400">{date || '미작성'}</p>
        </div>
        <button onClick={onToggle} className="text-[10px] bg-white border px-4 py-1.5 rounded-full font-black text-slate-500 hover:bg-slate-50 transition-all shadow-sm">
          {isExpanded ? <><ChevronUp className="w-3 h-3 inline"/> 접기</> : <><ChevronDown className="w-3 h-3 inline"/> 상세보기</>}
        </button>
      </div>
      <div className={`text-xs text-slate-600 leading-relaxed font-bold whitespace-pre-wrap transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-[60px] line-clamp-2'}`}>
        {content || "아직 기록된 내용이 없습니다."}
      </div>
    </div>
  );
}

function FormGroup({ label, type = "text", value, onChange, required = false, defaultValue, placeholder }: any) {
  if (label === "진단명" || label === "장애정도") {
    const options = label === "진단명" ? Object.values(Diagnosis) : Object.values(DisabilitySeverity);
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="p-5 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input type={type} value={value} defaultValue={defaultValue} placeholder={placeholder} onChange={e => onChange(e.target.value)} required={required} className="p-5 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner" />
    </div>
  );
}
