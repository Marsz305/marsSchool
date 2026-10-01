import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

const sanitizeInput = (str) => {
  if (!str) return ""
  let s = String(str).trim().slice(0, 254)
  s = s.split("<").join("").split(">").join("")
  s = s.split("/").join("").split("\\").join("")
  return s
}
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)

function AppWrapper(){
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState("login")
  const [form,setForm]=useState({email:"",password:"",full_name:"",role:"student"})
  const [attempts,setAttempts]=useState(0)
  const [lockedUntil,setLockedUntil]=useState(null)
  const [submitting,setSubmitting]=useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then((res)=>{
      const sess = res.data.session
      setUser(sess?.user||null)
      if(sess?.user) fetchProfile(sess.user.id)
      else setLoading(false)
    })
    const listener = supabase.auth.onAuthStateChange((e, sess)=>{
      setUser(sess?.user||null)
      if(sess?.user) fetchProfile(sess.user.id)
      else { setProfile(null); setLoading(false)}
    })
    return ()=>{ listener.data.subscription.unsubscribe() }
  },[])

  const fetchProfile=async(uid)=>{
    const res=await supabase.from('users').select('*').eq('id',uid).single()
    setProfile(res.data||null); setLoading(false)
  }

  const handleAuth=async(e)=>{
    e.preventDefault()
    if(lockedUntil && Date.now()<lockedUntil){
      const sec=Math.ceil((lockedUntil-Date.now())/1000)
      return alert("Too many tries. Wait "+sec+"s")
    }
    if(submitting) return
    setSubmitting(true)
    try{
      const cleanEmail=sanitizeInput(form.email).toLowerCase()
      const cleanPassword=form.password.trim().slice(0,72)
      const cleanName=sanitizeInput(form.full_name).slice(0,50)
      if(!isValidEmail(cleanEmail)){ alert("Enter a valid email"); return }
      if(cleanPassword.length<6){ alert("Password must be 6+ chars"); return }
      if(mode==="signup" && cleanName.length<2){ alert("Enter full name"); return }
      if(mode==="signup"){
        let safeRole="student"
        if(form.role==="student" || form.role==="faculty" || form.role==="parent") safeRole=form.role
        const res=await supabase.auth.signUp({email:cleanEmail,password:cleanPassword,options:{data:{full_name:cleanName}}})
        if(res.error) throw res.error
        await supabase.from('users').insert({id:res.data.user.id,email:cleanEmail,full_name:cleanName,role:safeRole,is_active:false})
        alert("Account created! Wait for Admin approval.")
        setMode("login")
        setForm({email:"",password:"",full_name:"",role:"student"})
      } else {
        const res=await supabase.auth.signInWithPassword({email:cleanEmail,password:cleanPassword})
        if(res.error) throw res.error
        const prof=await supabase.from('users').select('*').eq('id',res.data.user.id).single()
        if(prof.data &&!prof.data.is_active){ alert("Account pending approval"); await supabase.auth.signOut(); return }
        setUser(res.data.user); setProfile(prof.data); setAttempts(0)
      }
    }catch(err){
      const n=attempts+1; setAttempts(n)
      if(n>=5){ setLockedUntil(Date.now()+30000); alert("Too many failed attempts. Locked 30s") }
      else alert("Invalid email or password")
    }finally{ setSubmitting(false) }
  }

  const logout=async()=>{ await supabase.auth.signOut(); setUser(null); setProfile(null) }
  if(loading) return <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">Loading MARS...</div>
  if(!user) return <AuthPage mode={mode} setMode={setMode} form={form} setForm={setForm} onSubmit={handleAuth} lockedUntil={lockedUntil} submitting={submitting} />
  const role=(profile?.role||'').toLowerCase().trim()
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black text-white">M</div><span className="font-black text-white">MARS</span><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full ml-2 text-white">{profile?.role}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs text-zinc-400 hidden sm:block">{profile?.email}</span><button onClick={logout} className="bg-zinc-800 text-white px-3 py-1.5 rounded-full text-xs">Logout</button></div>
      </header>
      <main className="p-3 md:p-6">
        {role==="super_admin" || role==="school_admin" || role==="admin"? <AdminDash profile={profile} /> : null}
        {role==="faculty" || role==="teacher"? <FacultyDash profile={profile} /> : null}
        {role==="student"? <StudentDash profile={profile} /> : null}
        {role==="parent"? <ParentDash profile={profile} /> : null}
      </main>
    </div>
  )
}

function AuthPage({mode,setMode,form,setForm,onSubmit,lockedUntil,submitting}){
  const isLocked=lockedUntil && Date.now()<lockedUntil
  const emailClean=sanitizeInput(form.email).toLowerCase()
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#080808'}}>
      <div className="p-6 md:p-8 rounded-[24px] w-full max-w-[400px] border border-white/10" style={{background:'#18181b'}}>
        <h2 className="text-2xl font-black text-white mb-4">{mode==="login"?"Welcome Back":"Create Account"}</h2>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="Email" type="email" required maxLength={254} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500" />
          <input value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="Password" type="password" required maxLength={72} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/>
          {mode==="signup" && <>
            <input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} placeholder="Full Name" required maxLength={50} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500" />
            <select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="student">Student</option><option value="faculty">Faculty / Teacher</option><option value="parent">Parent</option></select>
          </>}
          <button disabled={submitting||isLocked} type="submit" className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white disabled:opacity-50">{submitting?"Please wait...":isLocked?"Locked - Wait 30s":mode==="login"?"Login":"Sign Up"}</button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-4"><button onClick={()=>setMode(mode==="login"?"signup":"login")} className="text-orange-400 font-bold">{mode==="login"?"Sign Up":"Login"}</button></p>
      </div>
    </div>
  )
}

function AdminDash({profile}){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([])
  const [tab,setTab]=useState("classes")
  const [classForm,setClassForm]=useState({name:"",faculty_id:"",student_ids:[]})
  const [editClassId,setEditClassId]=useState(null)
  const [addStudentIds,setAddStudentIds]=useState([])
  const load=async()=>{
    const u=await supabase.from('users').select('*').order('created_at',{ascending:false}); if(u.data) setUsers(u.data)
    const c=await supabase.from('classes').select('*').order('name'); if(c.data) setClasses(c.data)
  }
  useEffect(()=>{load()},[])
  const facultyList=users.filter((u)=>{ const r=(u.role||'').toLowerCase().trim(); return r==="faculty" || r==="teacher" })
  const studentList=users.filter((u)=>(u.role||'').toLowerCase()==="student")
  const toggleStudentInForm=(id)=>{ setClassForm((prev)=>{ if(prev.student_ids.includes(id)){ return {...prev, student_ids: prev.student_ids.filter((s)=>s!==id)} } else { return {...prev, student_ids: [...prev.student_ids, id]} } }) }
  const createClass=async()=>{
    const cleanName=sanitizeInput(classForm.name)
    if(!cleanName) return alert("Name needed")
    const res=await supabase.from('classes').insert({name:cleanName,faculty_id:classForm.faculty_id||null}).select().single()
    if(res.error) return alert(res.error.message)
    if(classForm.student_ids.length>0) await supabase.from('users').update({class_id:res.data.id}).in('id',classForm.student_ids)
    setClassForm({name:"",faculty_id:"",student_ids:[]}); load()
  }
  const addStudentsToClass=async(classId)=>{
    if(addStudentIds.length===0) return
    await supabase.from('users').update({class_id:classId}).in('id',addStudentIds)
    setAddStudentIds([]); setEditClassId(null); load()
  }
  return (
    <div className="space-y-6 max-w-[1300px] mx-auto w-full">
      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full overflow-x-auto border border-white/10">
        <button onClick={()=>setTab("classes")} className={"px-5 py-2.5 rounded-full text-sm font-bold shrink-0 "+(tab==="classes"?"bg-orange-600 text-white":"text-zinc-400")}>Classes ({classes.length})</button>
        <button onClick={()=>setTab("approvals")} className={"px-5 py-2.5 rounded-full text-sm font-bold shrink-0 "+(tab==="approvals"?"bg-orange-600 text-white":"text-zinc-400")}>Approvals ({users.filter((u)=>!u.is_active).length})</button>
      </div>
      {tab==="classes" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/70 border border-white/10 p-4 md:p-6 rounded-[24px]">
            <h3 className="font-black mb-4 text-white">Create Class + Assign</h3>
            <input value={classForm.name} onChange={(e)=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Geo" maxLength={30} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white placeholder:text-zinc-500"/>
            <select value={classForm.faculty_id} onChange={(e)=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"><option value="">Select Faculty</option>{facultyList.map((f)=><option key={f.id} value={f.id}>{f.email}</option>)}</select>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 max-h-[200px] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">{studentList.map((s)=>{const checked=classForm.student_ids.includes(s.id); return <label key={s.id} className={"flex items-center gap-2 p-2 rounded-xl cursor-pointer border "+(checked?"bg-orange-600/20 border-orange-500/30":"bg-zinc-800/50 border-white/5")}><input type="checkbox" checked={checked} onChange={()=>toggleStudentInForm(s.id)}/><span className="text-xs text-white truncate">{s.email}</span></label>})}</div>
            <button onClick={createClass} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">Create Class</button>
          </div>
          <div className="grid gap-4">{classes.map((c)=>{
            const faculty=users.find((u)=>u.id===c.faculty_id); const students=users.filter((u)=>u.class_id===c.id); const isEditing=editClassId===c.id
            return (
              <div key={c.id} className="bg-zinc-900/80 border border-white/10 p-4 md:p-5 rounded-[24px]">
                <div className="flex flex-col md:flex-row justify-between gap-3"><div><p className="font-black text-white text-lg">{c.name}</p><p className="text-xs text-zinc-400">Faculty: <span className="text-white">{faculty?faculty.email:"Not assigned"}</span> - {students.length} students</p></div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <button onClick={()=>{ if(isEditing){ setEditClassId(null) } else { setEditClassId(c.id) } setAddStudentIds([]) }} className="bg-zinc-800 text-white px-3 py-2 rounded-full text-xs font-bold">{isEditing?"Close":"Add Students"}</button>
                    <select value={c.faculty_id||''} onChange={async(e)=>{await supabase.from('classes').update({faculty_id:e.target.value||null}).eq('id',c.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white"><option value="">No Faculty</option>{facultyList.map((f)=><option key={f.id} value={f.id}>{f.email}</option>)}</select>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{students.map((s)=><span key={s.id} className="bg-black/50 border border-white/10 px-2.5 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5">{s.email}<button onClick={async()=>{await supabase.from('users').update({class_id:null}).eq('id',s.id); load()}} className="text-red-400 font-bold ml-1">x</button></span>)}</div>
                {isEditing && (<div className="mt-4 bg-black/40 border border-white/5 rounded-2xl p-3"><div className="max-h-[200px] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2">{users.filter((u)=>{ return (u.role||'').toLowerCase()==="student" &&!u.class_id }).map((s)=>{const checked=addStudentIds.includes(s.id); return <label key={s.id} className={"flex items-center gap-2 p-2 rounded-xl cursor-pointer border "+(checked?"bg-orange-600/20 border-orange-500/30":"bg-zinc-800/50 border-white/5")}><input type="checkbox" checked={checked} onChange={()=>{ setAddStudentIds((prev)=>{ if(prev.includes(s.id)){ return prev.filter((x)=>x!==s.id) } else { return [...prev, s.id] } }) }}/><span className="text-xs text-white truncate">{s.email}</span></label>})}</div><button onClick={()=>addStudentsToClass(c.id)} className="mt-3 w-full bg-white text-black py-2.5 rounded-xl text-xs font-black">Add {addStudentIds.length} Selected</button></div>)}
              </div>
            )
          })}</div>
        </div>
      )}
      {tab==="approvals" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><div className="grid gap-3 mt-4">{users.filter((u)=>!u.is_active).map((u)=>(<div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between gap-3"><div><p className="font-bold text-white">{u.email}</p></div><button onClick={async()=>{await supabase.from('users').update({is_active:true}).eq('id',u.id); load()}} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Approve</button></div>))}</div></div>)}
    </div>
  )
}

// FIXED FACULTY DASH - SHOWS SUBMISSIONS EVEN IF ADMIN CREATED ASSIGNMENT
function FacultyDash({profile}){
  const [classes,setClasses]=useState([]); const [users,setUsers]=useState([])
  const [assignments,setAssignments]=useState([]); const [allSubs,setAllSubs]=useState([]); const [filteredSubs,setFilteredSubs]=useState([])
  const [tab,setTab]=useState("submissions")
  const [form,setForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [uploading,setUploading]=useState(false)
  const [grades,setGrades]=useState({})
  const [feedbacks,setFeedbacks]=useState({})
  const [debug,setDebug]=useState("")

  const load=async()=>{
    try{
      const cRes=await supabase.from('classes').select('*'); if(cRes.data) setClasses(cRes.data)
      const uRes=await supabase.from('users').select('*'); if(uRes.data) setUsers(uRes.data)
      const aRes=await supabase.from('assignments').select('*').order('created_at',{ascending:false});
      if(aRes.data) setAssignments(aRes.data)

      // GET ALL SUBMISSIONS - NO FILTER IN DB, FILTER IN JS
      const sRes=await supabase.from('submissions').select('*, users!inner(id,email,full_name,class_id), assignments!inner(id,title,course,class_id,created_by)').order('created_at',{ascending:false})

      let debugMsg = ""
      debugMsg += "Classes: "+(cRes.data?.length||0)+" | Assignments: "+(aRes.data?.length||0)+" | Raw Submissions from DB: "+(sRes.data?.length||0)+"\n"
      if(sRes.error) debugMsg += "SUB ERROR: "+sRes.error.message+"\n"

      if(sRes.data) {
        setAllSubs(sRes.data)
        const myClassIds = (cRes.data||[]).filter((x)=>x.faculty_id===profile.id).map((x)=>x.id)
        debugMsg += "My Class IDs: "+JSON.stringify(myClassIds)+" | My Classes: "+(cRes.data||[]).filter((x)=>x.faculty_id===profile.id).map((x)=>x.name).join(',')+"\n"
        debugMsg += "My students in DB: "+(uRes.data||[]).filter((u)=>myClassIds.includes(u.class_id)).map((u)=>u.email).join(', ')+"\n"

        // FILTER LOGIC - THIS IS THE FIX
        const filtered = sRes.data.filter((sub)=>{
          const studentClassId = sub.users?.class_id
          const assignmentClassId = sub.assignments?.class_id
          const assignmentCreator = sub.assignments?.created_by
          // Show if: student in my class OR assignment in my class OR I created assignment
          return myClassIds.includes(studentClassId) || myClassIds.includes(assignmentClassId) || assignmentCreator===profile.id
        })
        debugMsg += "Filtered submissions for you: "+filtered.length+"\n"
        if(filtered.length===0 && sRes.data.length>0){
          debugMsg += "BUT DB has submissions: "+sRes.data.map((s)=> s.users.email + " -> class "+ s.users.class_id).join(', ')+"\n"
          debugMsg += "Your class IDs dont match student class IDs! Re-assign students in Admin panel."
        }
        setFilteredSubs(filtered)
        setDebug(debugMsg)
      } else {
        setDebug(debugMsg + "No submissions in DB at all - student did not submit or RLS blocks")
      }
    }catch(e){
      setDebug("Load error: "+e.message)
    }
  }

  useEffect(()=>{load()},[])

  const myClasses=classes.filter((c)=>c.faculty_id===profile.id)
  const myClassIds=myClasses.map((c)=>c.id)
  const myStudents=users.filter((u)=>myClassIds.includes(u.class_id) && u.role==="student")
  const myAssignments=assignments.filter((a)=>a.created_by===profile.id || myClassIds.includes(a.class_id))

  const createAssignment=async()=>{
    if(!form.title||!form.due_date) return alert("Title and Due date needed")
    setUploading(true)
    let url=null
    if(form.file){
      const path=Date.now()+"_"+sanitizeInput(form.file.name)
      const up=await supabase.storage.from('mars-files').upload(path,form.file)
      if(up.error){ alert(up.error.message); setUploading(false); return }
      url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl
    }
    const ins=await supabase.from('assignments').insert({title:sanitizeInput(form.title),course:sanitizeInput(form.course),due_date:form.due_date,class_id:form.class_id||myClassIds[0]||null,attachment_url:url,created_by:profile.id})
    if(ins.error) alert(ins.error.message)
    else { setForm({title:"",course:"",due_date:"",class_id:"",file:null}); load() }
    setUploading(false)
  }

  const saveGrade=async(sub)=>{
    const grade=grades[sub.id]!==undefined?grades[sub.id]:sub.grade||""
    const feedback=feedbacks[sub.id]!==undefined?feedbacks[sub.id]:sub.feedback||""
    if(!grade &&!feedback) return alert("Enter grade or comment")
    const up=await supabase.from('submissions').update({grade:grade, feedback:feedback}).eq('id', sub.id)
    if(up.error) alert(up.error.message)
    else { alert("Graded! Student will see it"); load() }
  }

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">My Classes</p><p className="text-3xl font-black text-white mt-1">{myClasses.length}</p><p className="text-[11px] text-zinc-400">{myClasses.map((c)=>c.name).join(', ')}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">My Students</p><p className="text-3xl font-black text-white mt-1">{myStudents.length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Assignments</p><p className="text-3xl font-black text-white mt-1">{myAssignments.length}</p></div>
        <div className="bg-zinc-900/70 border border-orange-500/20 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Submissions</p><p className="text-3xl font-black text-orange-400 mt-1">{filteredSubs.length}</p><p className="text-[9px] text-zinc-500">Raw DB: {allSubs.length}</p></div>
      </div>

      <div className="bg-black/60 border border-white/10 p-3 rounded-xl text-[11px] text-zinc-400 whitespace-pre-wrap font-mono">{debug}</div>

      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full border border-white/10 overflow-x-auto">
        <button onClick={()=>setTab("overview")} className={"px-5 py-2.5 rounded-full text-sm font-bold shrink-0 "+(tab==="overview"?"bg-orange-600 text-white":"text-zinc-400")}>Overview</button>
        <button onClick={()=>setTab("students")} className={"px-5 py-2.5 rounded-full text-sm font-bold shrink-0 "+(tab==="students"?"bg-orange-600 text-white":"text-zinc-400")}>My Students ({myStudents.length})</button>
        <button onClick={()=>setTab("create")} className={"px-5 py-2.5 rounded-full text-sm font-bold shrink-0 "+(tab==="create"?"bg-orange-600 text-white":"text-zinc-400")}>Create Assignment</button>
        <button onClick={()=>setTab("submissions")} className={"px-5 py-2.5 rounded-full text-sm font-bold shrink-0 "+(tab==="submissions"?"bg-orange-600 text-white":"text-zinc-400")}>Submissions ({filteredSubs.length})</button>
      </div>

      {tab==="overview" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <h3 className="font-black text-white mb-4">My Classes Allocated by Admin</h3>
          <div className="grid sm:grid-cols-2 gap-3">{myClasses.map((c)=><div key={c.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl"><p className="font-black text-white">{c.name}</p><p className="text-xs text-zinc-500">{users.filter((u)=>u.class_id===c.id).length} students</p></div>)}</div>
        </div>
      )}

      {tab==="students" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <h3 className="font-black text-white text-lg mb-4">Students in Geo</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{myStudents.map((s)=><div key={s.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl"><p className="font-bold text-sm text-white">{s.full_name||s.email}</p><p className="text-[11px] text-zinc-500">{s.email} | class_id: {s.class_id?.slice(0,6)}</p></div>)}</div>
        </div>
      )}

      {tab==="create" && (
        <div className="max-w-[600px] mx-auto bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]">
          <h3 className="font-black text-white text-xl mb-4">Create Assignment</h3>
          <div className="space-y-3">
            <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
            <div className="grid grid-cols-2 gap-3"><input value={form.course} onChange={(e)=>setForm({...form,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><select value={form.class_id} onChange={(e)=>setForm({...form,class_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">All My Classes</option>{myClasses.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <input type="datetime-local" value={form.due_date} onChange={(e)=>setForm({...form,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
            <input type="file" onChange={(e)=>setForm({...form,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/>
            <button disabled={uploading} onClick={createAssignment} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{uploading?"Publishing...":"Publish"}</button>
          </div>
        </div>
      )}

      {tab==="submissions" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <h3 className="font-black text-white text-lg mb-4">Submissions Received ({filteredSubs.length}) - Grade + Comment</h3>
          <div className="grid lg:grid-cols-2 gap-4">
            {filteredSubs.map((s)=>(
              <div key={s.id} className="bg-black/60 border border-white/5 p-4 rounded-2xl">
                <div className="flex justify-between"><div><p className="font-bold text-white text-sm">{s.users.full_name||s.users.email}</p><p className="text-[11px] text-zinc-500">{s.users.email}</p><p className="text-xs text-orange-400 mt-1">{s.assignments.title}</p></div><span className={"text-[10px] px-2 py-1 rounded-full h-fit "+(s.grade?"bg-green-500/20 text-green-400":"bg-orange-500/20 text-orange-400")}>{s.grade?"Graded: "+s.grade:"Needs Grading"}</span></div>
                <a href={s.file_url} target="_blank" rel="noreferrer" className="inline-block mt-3 bg-zinc-800 text-white px-3 py-2 rounded-xl text-xs">View File</a>
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={grades[s.id]!==undefined?grades[s.id]:s.grade||''} onChange={(e)=>setGrades({...grades,[s.id]:e.target.value})} placeholder="Grade e.g A, 85%" className="bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white"/>
                    <button onClick={()=>saveGrade(s)} className="bg-orange-600 text-white px-3 py-2.5 rounded-xl text-xs font-black">Save Grade + Comment</button>
                  </div>
                  <textarea value={feedbacks[s.id]!==undefined?feedbacks[s.id]:s.feedback||''} onChange={(e)=>setFeedbacks({...feedbacks,[s.id]:e.target.value})} placeholder="Write feedback / comment for student..." rows={3} className="w-full bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white placeholder:text-zinc-500"></textarea>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2">Submitted: {new Date(s.created_at).toLocaleString()}</p>
              </div>
            ))}
            {filteredSubs.length===0 && <div className="col-span-2 text-center py-10"><p className="text-zinc-500">No submissions for your class. Debug shows raw DB has {allSubs.length}. If raw is 0, RLS is blocking - run the SQL above.</p><button onClick={load} className="mt-3 bg-white text-black px-4 py-2 rounded-full text-xs font-black">Refresh</button></div>}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentDash({profile}){
  const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState([]); const [myClass,setMyClass]=useState(null)
  useEffect(()=>{(async()=>{
    const cls=await supabase.from('classes').select('*').eq('id',profile.class_id).single(); if(cls.data) setMyClass(cls.data)
    let q=supabase.from('assignments').select('*').order('due_date',{ascending:true})
    if(profile.class_id) q=q.or("class_id.eq."+profile.class_id+",class_id.is.null")
    const a=await q; if(a.data) setAssignments(a.data)
    const s=await supabase.from('submissions').select('*, assignments!inner(title,course)').eq('student_id',profile.id); if(s.data) setMySubs(s.data)
  })()},[profile])
  const submitWork=async(assignmentId,file)=>{
    if(!file) return
    const path=profile.id+"/"+Date.now()+"_"+sanitizeInput(file.name)
    const up=await supabase.storage.from('mars-files').upload(path,file)
    if(up.error) return alert(up.error.message)
    const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl
    await supabase.from('submissions').insert({assignment_id:assignmentId,student_id:profile.id,file_url:url,status:'submitted'})
    alert("Submitted!")
    const s=await supabase.from('submissions').select('*, assignments!inner(title,course)').eq('student_id',profile.id); if(s.data) setMySubs(s.data)
  }
  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="space-y-3">
        <h3 className="font-black text-white text-lg">My Assignments - {myClass?myClass.name:"No Class"}</h3>
        {assignments.map((a)=>{
          const sub=mySubs.find((s)=>s.assignment_id===a.id)
          return (
            <div key={a.id} className={"p-4 rounded-[20px] border "+(sub?"bg-green-500/5 border-green-500/20":"bg-zinc-900/70 border-white/10")}>
              <div className="flex justify-between gap-2"><div><p className="font-black text-white">{a.title}</p><p className="text-xs text-zinc-400">{a.course} - Due {a.due_date?new Date(a.due_date).toLocaleString():"No due"}</p></div>{sub? <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs h-fit font-bold">{sub.grade?"Grade: "+sub.grade:"Submitted"}</span> : <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs h-fit">Pending</span>}</div>
              {sub && sub.feedback && <div className="mt-2 bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl"><p className="text-[11px] text-orange-300 font-bold">Teacher Comment:</p><p className="text-xs text-white">{sub.feedback}</p></div>}
              {a.attachment_url&&<a href={a.attachment_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-orange-400 text-xs underline">Download Assignment</a>}
              <div className="mt-3 flex gap-2"><label className="flex-1 bg-zinc-800 border border-white/10 px-3 py-2.5 rounded-xl text-xs text-white cursor-pointer text-center">{sub?"Resubmit":"Upload Work"}<input type="file" hidden onChange={(e)=>submitWork(a.id,e.target.files[0])}/></label>{sub&&<a href={sub.file_url} target="_blank" rel="noreferrer" className="bg-white text-black px-3 py-2 rounded-xl text-xs font-bold">View Mine</a>}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ParentDash({profile}){
  const [child,setChild]=useState(null);
  useEffect(()=>{(async()=>{if(profile.linked_student_id){const d=await supabase.from('users').select('*').eq('id',profile.linked_student_id).single(); setChild(d.data)}})()},[profile]);
  return <div className="max-w-[800px] mx-auto"><h2 className="text-xl font-black text-white">Parent View</h2><p className="text-zinc-400">Child: {child?child.email:"Not linked"}</p></div>
}

export default AppWrapper