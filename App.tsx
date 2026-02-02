
import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, FileText, Search, Activity, Home,
  UserPlus, ArrowLeft, Loader2, LogOut, Sparkles,
  ChevronDown, ChevronUp, ShieldCheck, Settings, ExternalLink, CheckCircle2, AlertCircle, ChevronRight
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
  suspensions: any[];
}

interface TherapyLog {
  id: string;
  patientId: string;
  date: string;
  activityName: string;
  generatedLog: string;
  createdAt: number;
}

// --- 메인 앱 컴포넌트 ---
export default function App() {
  const [user] = useState<User>({ id: 'user_1', name: '김주영' });
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

  const [view, setView] = useState<'dashboard' | 'patients' | 'add_patient' | 'patient_detail' | 'generate_log'>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedAssessments, setExpandedAssessments] = useState<{ [key: string]: boolean }>({});
  
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // 데이터 저장
  useEffect(() => {
    localStorage.setItem('ot_patients_data', JSON.stringify(patients));
    localStorage.setItem('ot_logs_data', JSON.stringify(logs));
  }, [patients, logs]);

  const toggleAssessment = (key: string) => {
    setExpandedAssessments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeleteLog = (id: string) => {
    if (confirm("이 기록을 삭제하시겠습니까?")) {
      setLogs(prev => prev.filter(l => l.id !== id));
    }
  };

  // 5일치 일지 생성 로직
  const handleGenerateBatchLogs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPatient) return;
    
    setIsGenerating(true);
    const formData = new FormData(e.currentTarget);
    const activityInput = formData.get('activity') as string;
    const startDate = formData.get('date') as string;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `당신은 16년차 베테랑 작업치료사입니다. [${selectedPatient.name}]의 정보를 바탕으로 5일치 일지를 작성하세요.
      진단: ${selectedPatient.diagnosis}
      목표: ${selectedPatient.goals.join(", ")}
      활동: ${activityInput}
      시작일: ${startDate}
      
      [필수 양식]
      *제목
      1.
      2.
      3.
      4.
      5.
      
      *상담내용
      - 
      
      반드시 JSON 배열(logs)로 date, activityName, content를 포함하여 응답하세요. 전문적인 개조식(~함, ~임)을 사용하세요.`;

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

      const generatedData = JSON.parse(response.text).logs;
      const newLogs: TherapyLog[] = generatedData.map((log: any, idx: number) => ({
        id: (Date.now() + idx).toString(),
        patientId: selectedPatient.id,
        date: log.date,
        activityName: log.activityName,
        generatedLog: log.content,
        createdAt: Date.now() + idx
      }));

      setLogs(prev => [...newLogs, ...prev]);
      setView('patient_detail');
    } catch (error) {
      alert("AI 일지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
    localStorage.setItem('ot_auth_session', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ot_auth_session');
  };

  const [newPatientForm, setNewPatientForm] = useState({ name: '', gender: Gender.MALE, birthDate: '', diagnosis: Diagnosis.ASD, disabilitySeverity: DisabilitySeverity.SEVERE, goals: '', initialAssessment: '', initialAssessmentDate: new Date().toISOString().split('T')[0], interimAssessment: '', interimAssessmentDate: '', finalAssessment: '', finalAssessmentDate: '', therapyStartDate: new Date().toISOString().split('T')[0], suspensions: [] });

  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: Patient = { 
      id: Date.now().toString(), 
      ...newPatientForm, 
      goals: newPatientForm.goals.split(',').map(g => g.trim()).filter(g => g !== ''), 
    };
    setPatients(prev => [...prev, newPatient]);
    setView('patients');
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 border border-slate-100 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-12">
          <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6">
            <Activity className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">OT Master</h1>
          <p className="text-slate-400 text-sm font-bold mt-2">치료 업무를 위한 AI 파트너</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <input placeholder="아이디" required className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner focus:ring-2 focus:ring-emerald-500 transition-all" />
          <input type="password" placeholder="비밀번호" required className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner focus:ring-2 focus:ring-emerald-500 transition-all" />
          <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-200 transition-all active:scale-95">로그인</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] flex flex-col md:flex-row font-sans text-slate-900">
      {/* Side Navigation */}
      <nav className="w-full md:w-80 bg-slate-900 text-white p-8 sticky top-0 z-20 flex flex-col md:h-screen">
        <div className="flex items-center gap-4 mb-16">
          <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">OT Master</h1>
        </div>
        
        <ul className="flex-1 space-y-4">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Home/>} label="대시보드" />
          <NavItem active={view === 'patients' || view === 'patient_detail' || view === 'generate_log'} onClick={() => setView('patients')} icon={<Users/>} label="이용자 관리" />
          <NavItem active={view === 'add_patient'} onClick={() => setView('add_patient')} icon={<UserPlus/>} label="신규 등록" />
        </ul>

        <div className="mt-auto space-y-6 pt-8 border-t border-slate-800">
          <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Engine</span>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"></div>
             </div>
             <p className="text-sm font-black truncate">{user.name} 선생님</p>
             <p className="text-[10px] font-bold text-emerald-400">AI 일지 생성 준비됨</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-all">
            <LogOut className="w-5 h-5" /> <span>로그아웃</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto max-w-7xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <header>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-800 mb-2">{user.name} 선생님, 안녕하세요!</h2>
              <p className="text-slate-400 font-bold text-lg">오늘도 이용자들의 성장을 응원합니다.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <DashboardCard icon={<Users className="text-blue-500"/>} title="관리 중인 이용자" value={`${patients.length}명`} color="bg-blue-50/50" />
              <DashboardCard icon={<FileText className="text-emerald-500"/>} title="누적 치료 일지" value={`${logs.length}건`} color="bg-emerald-50/50" />
              <DashboardCard icon={<ShieldCheck className="text-purple-500"/>} title="데이터 보호 상태" value="안전" color="bg-purple-50/50" />
            </div>

            <div className="p-10 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col md:flex-row items-center justify-between gap-8 group">
               <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-500">
                    <Sparkles className="w-10 h-10 animate-pulse"/>
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">AI 치료 일지를 생성해보세요</h3>
                    <p className="text-slate-500 font-medium">16년차 전문가의 시선으로 5일치 일지를 10초 만에 작성합니다.</p>
                 </div>
               </div>
               <button onClick={() => setView('patients')} className="w-full md:w-auto px-10 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-2xl hover:bg-slate-800 transition-all">지금 시작하기</button>
            </div>
          </div>
        )}

        {view === 'patients' && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">이용자 목록</h2>
              <div className="relative w-full md:w-96 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" placeholder="이용자 이름으로 검색..." className="pl-14 pr-8 py-5 bg-white shadow-xl shadow-slate-200/30 rounded-[2.5rem] w-full font-bold outline-none border-2 border-transparent focus:border-emerald-500/20 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {patients.filter(p => p.name.includes(searchTerm)).map(patient => (
                <div key={patient.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:-translate-y-2 cursor-pointer transition-all relative overflow-hidden group" onClick={() => { setSelectedPatientId(patient.id); setView('patient_detail'); }}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[4rem] -mr-16 -mt-16 transition-all group-hover:bg-emerald-50"></div>
                  <h4 className="text-3xl font-black text-slate-800 mb-2 relative z-10 tracking-tighter">{patient.name}</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-8 relative z-10">{patient.diagnosis}</p>
                  
                  <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">진료 개시</span>
                      <p className="text-xs font-black text-slate-700">{patient.therapyStartDate}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setView('add_patient')} className="border-4 border-dashed border-slate-200 p-10 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50/20 cursor-pointer min-h-[260px] transition-all group">
                <PlusCircle className="w-16 h-16 mb-4 group-hover:scale-110 transition-transform" />
                <p className="font-black text-sm uppercase tracking-widest">이용자 신규 등록</p>
              </button>
            </div>
          </div>
        )}

        {view === 'patient_detail' && selectedPatient && (
          <div className="space-y-12 animate-in slide-in-from-right-8 duration-700 pb-24">
             <button onClick={() => setView('patients')} className="flex items-center gap-3 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase tracking-widest transition-colors"><ArrowLeft className="w-5 h-5" /> 목록으로</button>
             
             <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-100 p-10 md:p-16 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-4 h-full bg-emerald-500"></div>
                
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
                   <div className="space-y-4">
                      <div className="flex items-center gap-6">
                        <h2 className="text-5xl md:text-7xl font-black text-slate-800 tracking-tighter">{selectedPatient.name}</h2>
                        <span className="px-5 py-2 bg-blue-50 text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest">{selectedPatient.gender}성</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <span className="px-5 py-2 bg-slate-100 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedPatient.diagnosis}</span>
                        <span className="px-5 py-2 bg-emerald-100 rounded-2xl text-[10px] font-black text-emerald-700 uppercase tracking-widest">{selectedPatient.disabilitySeverity}</span>
                      </div>
                   </div>
                   
                   <button onClick={() => setView('generate_log')} className="w-full lg:w-auto px-12 py-7 bg-emerald-600 text-white rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all">
                      <Sparkles className="w-7 h-7" /> AI 5일치 일지 자동 생성
                   </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <AssessmentBox title="초기 평가" date={selectedPatient.initialAssessmentDate} content={selectedPatient.initialAssessment} isExpanded={expandedAssessments['initial']} onToggle={() => toggleAssessment('initial')} theme="emerald" />
                   <AssessmentBox title="중간 평가" date={selectedPatient.interimAssessmentDate} content={selectedPatient.interimAssessment} isExpanded={expandedAssessments['interim']} onToggle={() => toggleAssessment('interim')} theme="blue" />
                   <AssessmentBox title="종결 평가" date={selectedPatient.finalAssessmentDate} content={selectedPatient.finalAssessment} isExpanded={expandedAssessments['final']} onToggle={() => toggleAssessment('final')} theme="purple" />
                </div>
             </div>

             <div className="space-y-8">
                <h3 className="text-3xl font-black text-slate-800 tracking-tight px-4">치료 기록 <span className="text-emerald-500 ml-2">({logs.filter(l => l.patientId === selectedPatient.id).length})</span></h3>
                {logs.filter(l => l.patientId === selectedPatient.id).length === 0 ? (
                  <div className="p-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <FileText className="w-20 h-20 mb-6 opacity-10" />
                    <p className="font-black text-xl text-slate-400">등록된 치료 기록이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {logs.filter(l => l.patientId === selectedPatient.id).sort((a,b) => b.createdAt - a.createdAt).map(log => (
                      <div key={log.id} className="bg-white rounded-[3.5rem] shadow-xl shadow-slate-200/40 border border-slate-50 p-10 md:p-12 space-y-8 border-l-[12px] border-l-emerald-500 animate-in fade-in slide-in-from-left-8 duration-500">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em]">{log.date}</span>
                              <h4 className="text-3xl font-black text-slate-800 tracking-tight">{log.activityName}</h4>
                            </div>
                            <button onClick={() => handleDeleteLog(log.id)} className="p-4 rounded-3xl text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all">
                              <AlertCircle className="w-7 h-7" />
                            </button>
                          </div>
                          <div className="p-10 bg-slate-50 rounded-[2.5rem]">
                            <p className="text-slate-700 font-bold leading-[1.8] text-lg whitespace-pre-wrap">{log.generatedLog}</p>
                          </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}

        {view === 'generate_log' && selectedPatient && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-12 duration-700">
            <button onClick={() => setView('patient_detail')} className="mb-10 flex items-center gap-3 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase tracking-widest transition-colors"><ArrowLeft className="w-5 h-5" /> 뒤로가기</button>
            <div className="bg-white p-12 md:p-20 rounded-[5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-4 h-full bg-emerald-500"></div>
              <div className="space-y-4 mb-16">
                <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter">AI 일지 일괄 생성</h2>
                <p className="text-slate-400 font-bold text-lg leading-relaxed">이용자의 목표와 초기 소견을 분석하여<br/>현장에 바로 적용 가능한 5일치 일지를 작성합니다.</p>
              </div>
              
              <form onSubmit={handleGenerateBatchLogs} className="space-y-12">
                <div className="space-y-3">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">첫 번째 치료일</label>
                   <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-7 bg-slate-50 border-none rounded-[2rem] font-black text-xl shadow-inner outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">치료 활동 키워드</label>
                  <textarea name="activity" rows={5} className="w-full p-8 bg-slate-50 border-none rounded-[2.5rem] outline-none font-bold text-xl text-slate-700 shadow-inner focus:ring-4 focus:ring-emerald-500/10 transition-all" placeholder="예: 시지각 협응 강화, 눈-손 협응력 증진을 위한 퍼즐 맞추기, 대근육 발달 등"></textarea>
                </div>
                
                <button type="submit" disabled={isGenerating} className={`w-full py-10 rounded-[3rem] font-black text-2xl shadow-2xl flex items-center justify-center gap-6 transition-all ${isGenerating ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}>
                  {isGenerating ? <><Loader2 className="w-10 h-10 animate-spin" /> 임상 데이터 분석 중...</> : <><Sparkles className="w-10 h-10"/> 5일치 일지 자동 생성하기</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {view === 'add_patient' && (
          <div className="max-w-5xl mx-auto bg-white p-12 md:p-20 rounded-[5rem] shadow-2xl border border-slate-100 animate-in fade-in duration-700">
            <header className="mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter">신규 이용자 등록</h2>
              <p className="text-slate-400 font-bold text-lg ml-2 mt-2">이용자의 기초 정보를 등록하고 차트를 생성합니다.</p>
            </header>

            <form onSubmit={handleAddPatient} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FormGroup label="이름" value={newPatientForm.name} onChange={(v:any) => setNewPatientForm({...newPatientForm, name: v})} required />
                <FormGroup label="생년월일" type="date" value={newPatientForm.birthDate} onChange={(v:any) => setNewPatientForm({...newPatientForm, birthDate: v})} required />
                <FormGroup label="치료 시작일" type="date" value={newPatientForm.therapyStartDate} onChange={(v:any) => setNewPatientForm({...newPatientForm, therapyStartDate: v})} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormGroup label="주 진단명" value={newPatientForm.diagnosis} onChange={(v:any) => setNewPatientForm({...newPatientForm, diagnosis: v as Diagnosis})} />
                <FormGroup label="장애정도" value={newPatientForm.disabilitySeverity} onChange={(v:any) => setNewPatientForm({...newPatientForm, disabilitySeverity: v as DisabilitySeverity})} />
              </div>

              <FormGroup label="주요 치료 목표 (쉼표로 구분)" value={newPatientForm.goals} onChange={(v:any) => setNewPatientForm({...newPatientForm, goals: v})} placeholder="예: 시지각 변별력 향상, 눈-손 협응력 증진" required />
              
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">초기 평가 및 관찰 소견</label>
                 <textarea value={newPatientForm.initialAssessment} onChange={(e) => setNewPatientForm({...newPatientForm, initialAssessment: e.target.value})} rows={8} className="w-full p-8 bg-slate-50 border-none rounded-[3rem] outline-none font-bold text-xl text-slate-700 shadow-inner focus:ring-4 focus:ring-emerald-500/10 transition-all" placeholder="초기 평가 내용을 상세히 입력할수록 AI 일지 품질이 좋아집니다."></textarea>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setView('patients')} className="w-full sm:flex-1 px-10 py-6 border-2 border-slate-100 rounded-3xl font-black text-slate-400 hover:bg-slate-50 transition-all text-xl">취소</button>
                <button type="submit" className="w-full sm:flex-1 px-10 py-6 bg-emerald-600 text-white font-black rounded-3xl shadow-2xl hover:bg-emerald-700 transition-all text-xl">이용자 차트 등록</button>
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
      <button onClick={onClick} className={`w-full flex items-center gap-5 px-8 py-5 rounded-[2rem] transition-all group ${active ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-500/20 translate-x-2' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
        <span className="font-black text-sm uppercase tracking-[0.15em]">{label}</span>
      </button>
    </li>
  );
}

function DashboardCard({ icon, title, value, color }: any) {
  return (
    <div className={`${color} p-10 rounded-[3.5rem] shadow-sm flex items-center gap-10 group transition-all hover:scale-[1.03]`}>
      <div className="bg-white p-6 rounded-3xl shadow-lg">
        {React.cloneElement(icon as React.ReactElement, { className: "w-10 h-10" })}
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{title}</p>
        <p className="text-4xl font-black text-slate-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function AssessmentBox({ title, date, content, isExpanded, onToggle, theme }: any) {
  const bgMap: any = { emerald: 'bg-emerald-50/40 border-emerald-100', blue: 'bg-blue-50/40 border-blue-100', purple: 'bg-purple-50/40 border-purple-100' };
  const textMap: any = { emerald: 'text-emerald-600', blue: 'text-blue-600', purple: 'text-purple-600' };

  return (
    <div className={`${bgMap[theme]} p-10 rounded-[3rem] border relative flex flex-col min-h-[220px] transition-all group shadow-sm`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className={`text-[10px] font-black ${textMap[theme]} uppercase tracking-[0.3em] mb-1`}>{title}</p>
          <p className="text-[11px] font-black text-slate-400">{date || '미작성'}</p>
        </div>
        <button onClick={onToggle} className="text-[10px] bg-white border border-slate-100 px-5 py-2.5 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-all shadow-sm">
          {isExpanded ? <><ChevronUp className="w-3.5 h-3.5 inline mr-1"/> 접기</> : <><ChevronDown className="w-3.5 h-3.5 inline mr-1"/> 보기</>}
        </button>
      </div>
      <div className={`text-base text-slate-600 leading-relaxed font-bold whitespace-pre-wrap transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-[1500px]' : 'max-h-[100px] line-clamp-3'}`}>
        {content || "작성된 소견이 없습니다."}
      </div>
    </div>
  );
}

function FormGroup({ label, type = "text", value, onChange, required = false, defaultValue, placeholder }: any) {
  if (label === "주 진단명" || label === "장애정도") {
    const options = label === "주 진단명" ? Object.values(Diagnosis) : Object.values(DisabilitySeverity);
    return (
      <div className="flex flex-col gap-3">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-6 bg-slate-50 border-none rounded-[2rem] font-black text-xl shadow-inner outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">{label}</label>
      <input type={type} value={value} defaultValue={defaultValue} placeholder={placeholder} onChange={e => onChange(e.target.value)} required={required} className="w-full p-6 bg-slate-50 border-none rounded-[2rem] font-black text-xl shadow-inner outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
    </div>
  );
}

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
