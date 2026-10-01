import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

function AppWrapper(){
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState("login")
  const [form,setForm]=useState({email:"",password:"",full_name:"",role:"student"})

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setUser(data.session?.user||null)
      if(data.session?.user) fetchProfile(data.session.user.id)
      else setLoading(false)
    })
    const {data:listener}=supabase.auth.onAuthStateChange((_e,session)=>{
      setUser(session?.user||null)
      if(session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false)}
    })
    return ()=>listener.subscription.unsubscribe()
  },[])

  const fetchProfile=async(uid)=>{
    const {data}=await supabase.from('users').select('*').eq('id',uid).single()
    setProfile(data||null); setLoading(false)
  }

  const handleAuth=async(e)=>{
    e.preventDefault()
    if(mode==="signup"){
      const {data,error}=await supabase.auth.signUp({email:form.email,password:form.password})
      if(error) return alert(error.message)
      if(data.user){
        await supabase.from('users').insert({id:data.user.id,email:form.email,full_name:form.full_name,role:form.role,is_active:false})
        alert("Account created! Wait for Admin approval.")
        setMode("login")
      }
    } else {
      const {data,error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password})
      if(error) return alert(error.message)
      const {data:prof}=await supabase.from('users').select('*').eq('id',data.user.id).single()
      if(prof &&!prof.is_active) { alert("Account pending approval"); await supabase.auth.signOut(); return}
      setUser(data.user); setProfile(prof)
    }
  }

  const logout=async()=>{ await supabase.auth.signOut(); setUser(null); setProfile(null) }

  if(loading) return <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">Loading MARS...</div>
  if(!user) return <AuthPage mode={mode} setMode={setMode} form={form} setForm={setForm} onSubmit={handleAuth} />

  const role=(profile?.role||'').toLowerCase().trim()
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black">M</div><span className="font-black">MARS</span><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full ml-2">{profile?.role}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs text-zinc-400 hidden sm:block truncate max-w-[150px]">{profile?.email}</span><button onClick={logout} className="bg-zinc-800 px-3 py-1.5 rounded-full text-xs">Logout</button></div>
      </header>
      <main className="p-3 md:p-6">
        {role==='super_admin' || role==='school_admin' || role==='admin'? <AdminDash profile={profile} /> : null}
        {role==='faculty' || role==='teacher'? <FacultyDash profile={profile} /> : null}
        {role==='student'? <StudentDash profile={profile} /> : null}
        {role==='parent'? <ParentDash profile={profile} /> : null}
        {!['super_admin','school_admin','admin','faculty','teacher','student','parent'].includes(role) && <div className="text-center py-20">Unknown role: {profile?.role}</div>}
      </main>
    </div>
  )
}

function AuthPage({mode,setMode,form,setForm,onSubmit}){
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[24px] w-full max-w-[400px]">
        <div className="flex items-center gap-2 mb-6"><div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-white">M</div><div><p className="font-black text-white">MARS E-School</p><p className="text-[10px] text-zinc-500">Modern Learning OS</p></div></div>
        <h2 className="text-2xl font-black text-white mb-2">{mode==="login"?"Welcome Back":"Create Account"}</h2>
        <form onSubmit={onSubmit} className="space-y-3 mt-4">
          <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email" type="email" required className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
          <input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" type="password" required className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
          {mode==="signup" && <>
            <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Full Name" required className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white">
              <option value="student">Student</option><option value="faculty">Faculty / Teacher</option><option value="parent">Parent</option>
            </select>
          </>}
          <button type="submit" className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{mode==="login"?"Login":"Sign Up"}</button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-4">{mode==="login"?"No account?":"Have account?"} <button onClick={()=>setMode(mode==="login"?"signup":"login")} className="text-orange-400 font-bold">{mode==="login"?"Sign Up":"Login"}</button></p>
      </div>
    </div>
  )
}

function AdminDash({profile}){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([]); const [assignments,setAssignments]=useState([])
  const [tab,setTab]=useState("assignments")
  const [classForm,setClassForm]=useState({name:"",faculty_id:""})
  const [assignForm,setAssignForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [uploading,setUploading]=useState(false)
  const [subCount,setSubCount]=useState({})
  const load=async()=>{
    try{ const {data:u}=await supabase.from('users').select('*').order('created_at',{ascending:false}); if(u) setUsers(u)}catch{}
    try{ const {data:c}=await supabase.from('classes').select('*').order('name'); if(c) setClasses(c)}catch{}
    try{ const {data:a}=await supabase.from('assignments').select('*').order('created_at',{ascending:false}); if(a){ setAssignments(a); const {data:subs}=await supabase.from('submissions').select('assignment_id'); const m={}; subs?.forEach(s=>m[s.assignment_id]=(m[s.assignment_id]||0)+1); setSubCount(m)} }catch{}
  }
  useEffect(()=>{load()},[])
  const exportUsers=()=>{
    const rows=users.map(u=>({Email:u.email,Name:u.full_name,Role:u.role,Class:classes.find(c=>c.id===u.class_id)?.name||'No Class',Status:u.is_active?'Active':'Pending',Joined:new Date(u.created_at).toLocaleDateString()}))
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Users"); XLSX.writeFile(wb,`MARS-Users-${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const exportGrades=async()=>{
    const {data}=await supabase.from('submissions').select('*, users!inner(email,full_name), assignments!inner(title,course)')
    if(!data||data.length===0) return alert("No submissions yet")
    const rows=data.map(s=>({Student:s.users.full_name||s.users.email,Email:s.users.email,Assignment:s.assignments.title,Course:s.assignments.course,Grade:s.grade??'Not graded',Status:s.status,Submitted:new Date(s.submitted_at).toLocaleString(),Feedback:s.feedback||''}))
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Grades"); XLSX.writeFile(wb,`MARS-Grades-${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const exportAssignments=()=>{
    const rows=assignments.map(a=>({Title:a.title,Course:a.course,Class:classes.find(c=>c.id===a.class_id)?.name||'All Classes',Due:a.due_date?new Date(a.due_date).toLocaleString():'No due',Submissions:subCount[a.id]||0,Expired:a.due_date&&new Date(a.due_date)<new Date()?'Yes':'No'}))
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Assignments"); XLSX.writeFile(wb,`MARS-Assignments-${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const facultyList=users.filter(u=>['faculty','teacher'].includes((u.role||'').toLowerCase().trim()))
  const pending=users.filter(u=>!u.is_active)
  const expiredCount=assignments.filter(a=>a.due_date&&new Date(a.due_date)<new Date()).length
  return (
    <div className="space-y-6 max-w-[1300px] mx-auto w-full min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px] min-w-0"><p className="text-[10px] uppercase text-zinc-500">Pending</p><p className="text-3xl font-black text-orange-400">{pending.length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px] min-w-0"><p className="text-[10px] uppercase text-zinc-500">Students</p><p className="text-3xl font-black">{users.filter(u=>(u.role||'').toLowerCase()==='student'&&u.is_active).length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px] min-w-0"><p className="text-[10px] uppercase text-zinc-500">Faculty</p><p className="text-3xl font-black">{facultyList.length}</p></div>
        <div className="bg-zinc-900/70 border border-red-500/20 p-5 rounded-[20px] min-w-0"><p className="text-[10px] uppercase text-zinc-500">Expired</p><p className="text-3xl font-black text-red-400">{expiredCount}</p></div>
      </div>
      <div className="flex gap-2 flex-wrap w-full">
        <button onClick={exportUsers} className="bg-white text-black px-4 py-2 rounded-full text-xs font-black">📊 Export Users</button>
        <button onClick={exportGrades} className="bg-orange-600 text-white px-4 py-2 rounded-full text-xs font-black">📈 Export Grades</button>
        <button onClick={exportAssignments} className="bg-zinc-800 text-white border border-white/10 px-4 py-2 rounded-full text-xs font-bold">📄 Export Assignments</button>
      </div>
      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full w-full max-w-full overflow-x-auto whitespace-nowrap border border-white/10">
        {[{id:"approvals",l:`Approvals (${pending.length})`},{id:"users",l:"All Users"},{id:"classes",l:"Classes"},{id:"assignments",l:`Assignments (${assignments.length})`}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold shrink-0 ${tab===t.id?'bg-orange-600 text-white':'text-zinc-400'}`}>{t.l}</button>)}
      </div>
      {tab==="approvals" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-4 md:p-6 w-full min-w-0"><h3 className="font-black text-lg">New Accounts Waiting</h3><div className="grid gap-3 mt-4">{pending.length===0&&<p className="text-center py-10 text-zinc-500">No pending</p>}{pending.map(u=>(<div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-3"><div className="min-w-0"><p className="font-bold truncate">{u.email}</p><p className="text-xs text-zinc-400">{u.full_name} - <span className="text-orange-400 font-bold">{u.role}</span></p></div><div className="flex gap-2 flex-wrap"><select id={`c-${u.id}`} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-sm text-white flex-1"><option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={async()=>{const cid=document.getElementById(`c-${u.id}`).value||null; await supabase.from('users').update({is_active:true,class_id:cid}).eq('id',u.id); load()}} className="bg-green-600 px-4 py-2 rounded-xl text-sm font-bold">Approve</button><button onClick={async()=>{await supabase.from('users').delete().eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-2 rounded-xl text-sm">Reject</button></div></div>))}</div></div>)}
      {tab==="users" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-2 md:p-6 w-full min-w-0 overflow-hidden"><div className="w-full overflow-x-auto"><table className="w-full text-sm min-w-[900px]"><thead><tr className="text-zinc-500 text-xs uppercase"><th className="text-left p-3">USER</th><th>ROLE</th><th>CLASS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t border-white/5"><td className="p-3 font-bold">{u.email}<p className="text-xs text-zinc-500">{u.full_name}</p></td><td><select value={(u.role||'').toLowerCase()} onChange={async(e)=>{await supabase.from('users').update({role:e.target.value}).eq('id',u.id); load()}} className="bg-black border border-white/10 p-2 rounded-xl text-xs text-white"><option value="student">student</option><option value="faculty">faculty</option><option value="teacher">teacher</option><option value="school_admin">school_admin</option><option value="super_admin">super_admin</option></select></td><td><select value={u.class_id||''} onChange={async(e)=>{await supabase.from('users').update({class_id:e.target.value||null}).eq('id',u.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white min-w-[160px]"><option value="">- No Class -</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td><td>{u.is_active?<span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Active</span>:<span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">Pending</span>}</td><td className="flex gap-1 p-2"><button onClick={async()=>{await supabase.from('users').update({is_active:!u.is_active}).eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-1 rounded-xl text-xs">{u.is_active?'Revoke':'Approve'}</button></td></tr>)}</tbody></table></div></div>)}
      {tab==="classes" && (<div className="grid lg:grid-cols-2 gap-6 w-full min-w-0"><div className="bg-zinc-900/70 border border-white/10 p-4 md:p-6 rounded-[24px] min-w-0"><h3 className="font-black mb-4">Create Class</h3><input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Form 1A" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"/><select value={classForm.faculty_id} onChange={e=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"><option value="">Select Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email}</option>)}</select><button onClick={async()=>{if(!classForm.name) return; await supabase.from('classes').insert({name:classForm.name,faculty_id:classForm.faculty_id||null}); setClassForm({name:"",faculty_id:""}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">Create Class</button><div className="mt-6 space-y-2">{classes.map(c=><div key={c.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between"><div><p className="font-bold">{c.name}</p><p className="text-xs text-zinc-500">{users.filter(u=>u.class_id===c.id).length} students</p></div><button onClick={async()=>{if(!confirm('Delete class?'))return; await supabase.from('classes').delete().eq('id',c.id); load()}} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs">Delete</button></div>)}</div></div><div className="bg-zinc-900/70 border border-white/10 p-4 md:p-6 rounded-[24px] min-w-0"><h3 className="font-black mb-4">Roster</h3>{classes.map(c=><div key={c.id} className="mb-6"><p className="font-bold text-orange-400">{c.name}</p>{users.filter(u=>u.class_id===c.id).map(u=><div key={u.id} className="text-sm bg-black/40 p-2 rounded-xl mt-1 truncate">{u.email} ({u.role})</div>)}</div>)}</div></div>)}
      {tab==="assignments" && (<div className="grid lg:grid-cols-2 gap-6 w-full min-w-0"><div className="bg-zinc-900/70 border border-orange-500/20 p-4 md:p-6 rounded-[24px] h-fit min-w-0"><h3 className="font-black mb-4">Publish Assignment</h3><div className="space-y-3"><input value={assignForm.title} onChange={e=>setAssignForm({...assignForm,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input value={assignForm.course} onChange={e=>setAssignForm({...assignForm,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><select value={assignForm.class_id} onChange={e=>setAssignForm({...assignForm,class_id:e.target.value})} className="bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">All Classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><input type="datetime-local" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><input type="file" onChange={e=>setAssignForm({...assignForm,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/><button disabled={uploading} onClick={async()=>{if(!assignForm.title||!assignForm.due_date)return alert('Title & Due date needed'); setUploading(true); let url=null; if(assignForm.file){const path=`${Date.now()}_${assignForm.file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path,assignForm.file); if(error){alert(error.message); setUploading(false); return;} url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl} const {data:ses}=await supabase.auth.getUser(); const {error}=await supabase.from('assignments').insert({title:assignForm.title,course:assignForm.course,due_date:assignForm.due_date,class_id:assignForm.class_id||null,attachment_url:url,created_by:ses.user.id}); if(error) alert(error.message); setUploading(false); setAssignForm({title:"",course:"",due_date:"",class_id:"",file:null}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">{uploading?'Publishing...':'Publish'}</button></div></div><div className="bg-zinc-900/70 border border-white/10 p-4 md:p-6 rounded-[24px] min-w-0"><div className="flex justify-between items-center mb-4 flex-wrap gap-2"><h3 className="font-black">Assignments ({assignments.length})</h3></div><div className="space-y-2 max-h-[600px] overflow-auto">{assignments.map(a=>{const isExpired=a.due_date&&new Date(a.due_date)<new Date(); return <div key={a.id} className={`p-3 rounded-xl flex flex-col sm:flex-row justify-between gap-2 border ${isExpired?'bg-red-500/10 border-red-500/20':'bg-black/40 border-white/5'}`}><div className="min-w-0"><p className="font-bold text-sm truncate">{a.title} - {classes.find(c=>c.id===a.class_id)?.name||'All'} <span className="text-orange-400 ml-1 text-xs">{subCount[a.id]?`${subCount[a.id]} subs`:''}</span></p><p className="text-[10px] text-zinc-500">Due: {a.due_date?new Date(a.due_date).toLocaleString():'No due'}</p></div><div className="flex gap-1 items-center shrink-0">{a.attachment_url&&<a href={a.attachment_url} target="_blank" className="text-orange-400 underline text-xs px-2">File</a>}<button onClick={async()=>{if(!confirm("Delete?"))return; await supabase.from('assignments').delete().eq('id',a.id); load()}} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold">Delete</button></div></div>})}</div></div></div>)}
    </div>
  )
}

function FacultyDash({profile}){
  const [classes,setClasses]=useState([]); const [assignments,setAssignments]=useState([]); const [subs,setSubs]=useState([])
  useEffect(()=>{(async()=>{const {data:c}=await supabase.from('classes').select('*'); if(c) setClasses(c); const {data:a}=await supabase.from('assignments').select('*').order('created_at',{ascending:false}); if(a) setAssignments(a); const {data:s}=await supabase.from('submissions').select('*, users!inner(email,full_name), assignments!inner(title)'); if(s) setSubs(s)})()},[])
  return <div className="max-w-[1100px] mx-auto space-y-6"><h2 className="text-2xl font-black">Faculty: {classes.filter(c=>c.faculty_id===profile.id).map(c=>c.name).join(', ')||'All Classes'}</h2><div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><h3 className="font-black mb-4">Submissions ({subs.length})</h3><div className="space-y-2">{subs.map(s=><div key={s.id} className="bg-black/40 p-3 rounded-xl flex justify-between text-sm"><span>{s.users.email} - {s.assignments.title} - Grade: {s.grade||'N/A'}</span><input placeholder="Grade" className="bg-zinc-800 p-1 rounded w-20 text-white" onBlur={async(e)=>{await supabase.from('submissions').update({grade:e.target.value}).eq('id',s.id)}}/></div>)}</div></div></div>
}
function StudentDash({profile}){
  const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState([])
  useEffect(()=>{(async()=>{let q=supabase.from('assignments').select('*').order('due_date'); if(profile.class_id) q=q.or(`class_id.eq.${profile.class_id},class_id.is.null`); const {data}=await q; if(data) setAssignments(data); const {data:s}=await supabase.from('submissions').select('*').eq('student_id',profile.id); if(s) setMySubs(s)})()},[profile])
  const submitWork=async(assignmentId,file)=>{
    if(!file) return; const path=`${profile.id}/${Date.now()}_${file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path,file); if(error) return alert(error.message); const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl; await supabase.from('submissions').insert({assignment_id:assignmentId,student_id:profile.id,file_url:url,status:'submitted'}); alert("Submitted!")
  }
  return <div className="max-w-[900px] mx-auto space-y-4"><h2 className="text-xl font-black">My Assignments</h2>{assignments.map(a=>{const isDone=mySubs.find(s=>s.assignment_id===a.id); const isExpired=a.due_date&&new Date(a.due_date)<new Date(); return <div key={a.id} className={`p-4 rounded-2xl border ${isExpired?'bg-red-500/10 border-red-500/20':'bg-zinc-900/70 border-white/10'}`}><div className="flex justify-between"><p className="font-bold">{a.title} - {a.course}</p>{isDone&&<span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">{isDone.grade?`Grade: ${isDone.grade}`:'Submitted'}</span>}</div><p className="text-xs text-zinc-500">Due: {a.due_date?new Date(a.due_date).toLocaleString():'No due'} {isExpired&&' - EXPIRED'}</p>{a.attachment_url&&<a href={a.attachment_url} target="_blank" className="text-orange-400 text-xs underline">Download Assignment</a>}<div className="mt-3"><input type="file" onChange={e=>submitWork(a.id,e.target.files[0])} className="text-xs file:bg-orange-600 file:text-white file:border-0 file:px-3 file:py-1 file:rounded-full"/></div></div>})}</div>
}
function ParentDash({profile}){
  const [child,setChild]=useState(null)
  useEffect(()=>{(async()=>{if(profile.linked_student_id){const {data}=await supabase.from('users').select('*').eq('id',profile.linked_student_id).single(); setChild(data)}})()},[profile])
  return <div className="max-w-[800px] mx-auto"><h2 className="text-xl font-black">Parent View</h2><p className="text-zinc-400">Child: {child?.email||'Not linked yet'}</p></div>
}

export default AppWrapper