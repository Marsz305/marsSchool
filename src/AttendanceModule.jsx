function AttendanceModule({ profile, classes, enrollments, users }){
    const [selectedClass, setSelectedClass] = useState(classes[0]?.id || "")
    const [date, setDate] = useState(new Date().toISOString().slice(0,10))
    const [records, setRecords] = useState({}) // student_id -> status
    const [existing, setExisting] = useState([])
    const [saving, setSaving] = useState(false)
    const [currentYear, setCurrentYear] = useState(null)
    const [currentTerm, setCurrentTerm] = useState(null)
  
    useEffect(()=>{ (async()=>{
      const y = await supabase.from('academic_years').select('*').eq('is_current',true).single(); if(y.data) setCurrentYear(y.data)
      const t = await supabase.from('terms').select('*').limit(1).single(); if(t.data) setCurrentTerm(t.data)
    })()},[])
  
    const studentsInClass = users.filter(u => enrollments.filter(e=>e.class_id===selectedClass).map(e=>e.student_id).includes(u.id))
  
    const loadAttendance = async()=>{
      if(!selectedClass ||!date) return
      const {data} = await supabase.from('attendance').select('*').eq('class_id', selectedClass).eq('date', date)
      if(data){
        setExisting(data)
        const map={}
        data.forEach(r=> map[r.student_id]=r.status)
        setRecords(map)
      } else setRecords({})
    }
    useEffect(()=>{ loadAttendance() },[selectedClass, date])
  
    const setStatus = (studentId, status)=> setRecords(prev=> ({...prev, [studentId]: status}))
  
    const saveAll = async()=>{
      if(!selectedClass) return alert("Select class")
      setSaving(true)
      // Upsert - update if exists, insert if not
      for(const s of studentsInClass){
        const status = records[s.id] || 'present' // default present
        const existingRec = existing.find(e=>e.student_id===s.id)
        if(existingRec){
          await supabase.from('attendance').update({status, marked_by: profile.id}).eq('id', existingRec.id)
        } else {
          await supabase.from('attendance').insert({
            student_id: s.id,
            class_id: selectedClass,
            academic_year_id: currentYear?.id,
            term_id: currentTerm?.id,
            date,
            status,
            marked_by: profile.id
          })
        }
      }
      setSaving(false)
      alert(`Attendance saved for ${studentsInClass.length} students - ${date}`)
      loadAttendance()
    }
  
    const markAll = (status)=>{
      const map={}
      studentsInClass.forEach(s=> map[s.id]=status)
      setRecords(map)
    }
  
    const stats = {
      present: Object.values(records).filter(v=>v==='present').length,
      absent: Object.values(records).filter(v=>v==='absent').length,
      late: Object.values(records).filter(v=>v==='late').length,
    }
  
    return (
      <div className="space-y-4">
        <div className="bg-zinc-900/70 border border-white/10 p-4 rounded-[20px] flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex gap-2">
            <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="bg-zinc-800 border border-white/10 p-3 rounded-xl text-white text-sm">
              {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="bg-zinc-800 border border-white/10 p-3 rounded-xl text-white text-sm"/>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>markAll('present')} className="bg-green-600/20 text-green-400 px-3 py-2 rounded-full text-xs font-bold">All Present</button>
            <button onClick={()=>markAll('absent')} className="bg-red-600/20 text-red-400 px-3 py-2 rounded-full text-xs font-bold">All Absent</button>
            <button onClick={saveAll} disabled={saving} className="bg-orange-600 text-white px-5 py-2 rounded-full text-xs font-black disabled:opacity-50">{saving?'Saving...':'Save Attendance'}</button>
          </div>
        </div>
  
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl"><p className="text-[10px] text-green-400 uppercase">Present</p><p className="text-2xl font-black text-white">{stats.present}</p></div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl"><p className="text-[10px] text-yellow-400 uppercase">Late</p><p className="text-2xl font-black text-white">{stats.late}</p></div>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"><p className="text-[10px] text-red-400 uppercase">Absent</p><p className="text-2xl font-black text-white">{stats.absent}</p></div>
        </div>
  
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_90px_90px] gap-2 p-3 bg-black/40 text-[11px] uppercase tracking-widest text-zinc-500 font-bold">
            <div>Student</div><div className="text-center">Present</div><div className="text-center">Late</div><div className="text-center">Absent</div>
          </div>
          <div className="divide-y divide-white/5 max-h-[500px] overflow-auto">
            {studentsInClass.map(s=>{
              const cur = records[s.id] || 'present'
              return (
                <div key={s.id} className="grid grid-cols-[1fr_90px_90px_90px] gap-2 p-3 items-center hover:bg-white/[0.03]">
                  <div className="flex items-center gap-2 min-w-0"><div className="w-8 h-8 bg-orange-600/20 rounded-full flex items-center justify-center font-black text-orange-400 text-xs">{s.full_name?.[0]||s.email[0].toUpperCase()}</div><div className="min-w-0"><p className="text-sm font-bold text-white truncate">{s.full_name||s.email}</p><p className="text-[11px] text-zinc-500 truncate">{s.email}</p></div></div>
                  <button onClick={()=>setStatus(s.id,'present')} className={`py-2 rounded-xl text-xs font-bold ${cur==='present'?'bg-green-600 text-white':'bg-zinc-800 text-zinc-400'}`}>✅</button>
                  <button onClick={()=>setStatus(s.id,'late')} className={`py-2 rounded-xl text-xs font-bold ${cur==='late'?'bg-yellow-600 text-white':'bg-zinc-800 text-zinc-400'}`}>⏰</button>
                  <button onClick={()=>setStatus(s.id,'absent')} className={`py-2 rounded-xl text-xs font-bold ${cur==='absent'?'bg-red-600 text-white':'bg-zinc-800 text-zinc-400'}`}>❌</button>
                </div>
              )
            })}
            {studentsInClass.length===0 && <p className="p-10 text-center text-zinc-500 text-sm">No students in this class. Enroll students first.</p>}
          </div>
        </div>
      </div>
    )
  }
  
  // Student view - add inside StudentDash
  function StudentAttendanceView({profile}){
    const [att, setAtt] = useState([])
    useEffect(()=>{(async()=>{
      const {data} = await supabase.from('attendance').select('*').eq('student_id', profile.id).order('date',{ascending:false}).limit(30)
      if(data) setAtt(data)
    })()},[])
    const present = att.filter(a=>a.status==='present').length
    const rate = att.length? Math.round(present/att.length*100) : 0
    return (
      <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-5">
        <h4 className="font-black text-white mb-3">My Attendance - {rate}%</h4>
        <div className="w-full bg-zinc-800 rounded-full h-2 mb-4"><div className="bg-green-500 h-2 rounded-full" style={{width:`${rate}%`}}></div></div>
        <div className="space-y-2 max-h-[300px] overflow-auto">{att.map(a=><div key={a.id} className="flex justify-between text-sm bg-black/30 p-2.5 rounded-xl"><span className="text-zinc-400">{a.date}</span><span className={`font-bold ${a.status==='present'?'text-green-400':a.status==='absent'?'text-red-400':'text-yellow-400'}`}>{a.status.toUpperCase()}</span></div>)}{att.length===0 && <p className="text-xs text-zinc-500">No attendance records yet</p>}</div>
      </div>
    )
  }