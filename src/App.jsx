import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

function AdminDash(){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([]); const [assignments,setAssignments]=useState([])
  const [tab,setTab]=useState("users")
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
  const facultyList = users.filter(u=> ['faculty','teacher'].includes((u.role||'').toLowerCase().trim()))
  const pending = users.filter(u=>!u.is_active)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Pending</p><p className="text-3xl font-black text-orange-400">{pending.length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Students</p><p className="text-3xl font-black">{users.filter(u=> (u.role||'').toLowerCase()==='student' && u.is_active).length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Faculty</p><p className="text-3xl font-black">{facultyList.length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Classes</p><p className="text-3xl font-black">{classes.length}</p></div>
      </div>
      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full w-fit border border-white/10">
        {[{id:"approvals",l:`Approvals (${pending.length})`},{id:"users",l:"All Users"},{id:"classes",l:"Classes"},{id:"assignments",l:"Assignments"}].map(t=>
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold ${tab===t.id?'bg-orange-600 text-white':'text-zinc-400'}`}>{t.l}</button>
        )}
      </div>
      {tab==="assignments" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]">
            <h3 className="font-black mb-4">Publish Assignment</h3>
            <div className="space-y-3">
              <input value={assignForm.title} onChange={e=>setAssignForm({...assignForm,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
              <div className="grid grid-cols-2 gap-3"><input value={assignForm.course} onChange={e=>setAssignForm({...assignForm,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><select value={assignForm.class_id} onChange={e=>setAssignForm({...assignForm,class_id:e.target.value})} className="bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">All Classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <input type="datetime-local" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
              <input type="file" onChange={e=>setAssignForm({...assignForm,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/>
              <button disabled={uploading} onClick={async()=>{ if(!assignForm.title||!assignForm.due_date) return alert('Title & Due date needed'); setUploading(true); let url=null; if(assignForm.file){ const path=`${Date.now()}_${assignForm.file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path, assignForm.file); if(error){ alert(error.message); setUploading(false); return;} url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl } const {data:ses}=await supabase.auth.getUser(); await supabase.from('assignments').insert({title:assignForm.title,course:assignForm.course,due_date:assignForm.due_date,class_id:assignForm.class_id||null,attachment_url:url, created_by: ses.user.id}); alert('Published!'); setUploading(false); setAssignForm({title:"",course:"",due_date:"",class_id:"",file:null}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">{uploading?'Publishing...':'Publish'}</button>
            </div>
          </div>
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Assignments ({assignments.length})</h3>{assignments.map(a=><div key={a.id} className="bg-black/40 p-3 rounded-xl mb-2 text-sm flex justify-between"><span>{a.title} - {classes.find(c=>c.id===a.class_id)?.name||'All'} <span className="text-orange-400 ml-2">{subCount[a.id]?`${subCount[a.id]} subs`:''}</span></span>{a.attachment_url && <a href={a.attachment_url} target="_blank" className="text-orange-400 underline">File</a>}</div>)}</div>
        </div>
      )}
      {tab==="users" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6 overflow-auto"><table className="w-full text-sm min-w-[900px]"><thead><tr className="text-zinc-500 text-xs uppercase"><th className="text-left p-3">USER</th><th>ROLE</th><th>CLASS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t border-white/5"><td className="p-3 font-bold">{u.email}<p className="text-xs text-zinc-500">{u.full_name}</p></td><td><select value={(u.role||'').toLowerCase()} onChange={async(e)=>{await supabase.from('users').update({role:e.target.value}).eq('id',u.id); load()}} className="bg-black border border-white/10 p-2 rounded-xl text-xs text-white"><option value="student">student</option><option value="faculty">faculty</option><option value="teacher">teacher</option><option value="school_admin">school_admin</option><option value="super_admin">super_admin</option></select></td><td><select value={u.class_id||''} onChange={async(e)=>{await supabase.from('users').update({class_id:e.target.value||null}).eq('id',u.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white min-w-[160px]"><option value="">- No Class -</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td><td>{u.is_active?<span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Active</span>:<span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">Pending</span>}</td><td className="flex gap-1 p-2"><button onClick={async()=>{await supabase.from('users').update({is_active:!u.is_active}).eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-1 rounded-xl text-xs">{u.is_active?'Revoke':'Approve'}</button></td></tr>)}</tbody></table></div>)}
      {tab==="classes" && (<div className="grid lg:grid-cols-2 gap-6"><div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Create Class</h3><input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Form 1A" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"/><select value={classForm.faculty_id} onChange={e=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"><option value="">Select Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email} - {f.full_name}</option>)}</select><button onClick={async()=>{ if(!classForm.name) return; await supabase.from('classes').insert({name:classForm.name, faculty_id:classForm.faculty_id||null}); setClassForm({name:"",faculty_id:""}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">Create Class</button></div><div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Roster</h3>{classes.map(c=><div key={c.id} className="mb-6"><p className="font-bold text-orange-400">{c.name} → {facultyList.find(f=>f.id===c.faculty_id)?.email||'No teacher'}</p>{users.filter(u=>u.class_id===c.id).map(u=><div key={u.id} className="text-sm bg-black/40 p-2 rounded-xl mt-1 flex justify-between"><span>{u.email} ({u.role})</span></div>)}</div>)}</div></div>)}
      {tab==="approvals" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><h3 className="font-black text-lg">New Accounts Waiting</h3><div className="grid gap-3 mt-4">{pending.map(u=><div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between"><div><p className="font-bold">{u.email}</p><p className="text-xs text-zinc-400">{u.full_name} - {u.role}</p></div><div className="flex gap-2"><select id={`c-${u.id}`} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-sm text-white"><option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={async()=>{ const cid=document.getElementById(`c-${u.id}`).value||null; await supabase.from('users').update({is_active:true, class_id:cid}).eq('id',u.id); load()}} className="bg-green-600 px-4 py-2 rounded-xl text-sm font-bold">Approve</button></div></div>)}</div></div>)}
    </div>
  )
}

function FacultyDash({user, profile}){
  const [myClasses,setMyClasses]=useState([]); const [students,setStudents]=useState([]); const [assignments,setAssignments]=useState([]);
  const [form,setForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [selectedAssign,setSelectedAssign]=useState(null); const [subs,setSubs]=useState([]);
  const load=async()=>{
    const {data:c}=await supabase.from('classes').select('*').eq('faculty_id',user.id); if(c){ setMyClasses(c); if(c.length &&!form.class_id) setForm(f=>({...f, class_id:c[0].id})); const ids=c.map(x=>x.id); if(ids.length){ const {data:u}=await supabase.from('users').select('*').in('class_id',ids); if(u) setStudents(u) } }
    const {data:as}=await supabase.from('assignments').select('*').eq('created_by', user.id).order('created_at',{ascending:false}); if(as) setAssignments(as);
  }
  useEffect(()=>{ load() },[])
  const viewSubs=async(assign)=>{
    setSelectedAssign(assign);
    const {data}=await supabase.from('submissions').select('*, users!submissions_student_id_fkey(full_name,email)').eq('assignment_id', assign.id).order('submitted_at',{ascending:false});
    setSubs(data||[]);
  }
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-orange-600/20 to-zinc-900 border border-orange-500/20 p-6 rounded-[24px]"><h2 className="text-2xl font-black">Welcome, {profile.full_name||user.email}</h2><p className="text-zinc-400">You teach: {myClasses.map(c=>c.name).join(', ')||'No class'} • {students.length} students</p></div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">My Students ({students.length})</h3>{myClasses.map(c=><div key={c.id} className="mb-4"><p className="font-bold text-orange-400">{c.name}</p>{students.filter(s=>s.class_id===c.id).map(s=><div key={s.id} className="bg-black/40 p-2 rounded-xl mt-1 text-sm">{s.email}</div>)}</div>)}</div>
          <div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]"><h3 className="font-black mb-4">Create Assignment</h3><div className="space-y-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><input value={form.course} onChange={e=>setForm({...form,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">Select Class</option>{myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><input type="file" onChange={e=>setForm({...form,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/><button onClick={async()=>{ if(!form.title||!form.class_id) return alert('Title & Class required'); let url=null; if(form.file){ const path=`${Date.now()}_${form.file.name}`; await supabase.storage.from('mars-files').upload(path,form.file); url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl } await supabase.from('assignments').insert({title:form.title,course:form.course,due_date:form.due_date,class_id:form.class_id,attachment_url:url, created_by:user.id}); alert('Published'); load() }} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">Publish</button></div></div>
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">My Assignments ({assignments.length})</h3>{assignments.map(a=><div key={a.id} className="bg-black/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center mb-2"><div><p className="font-bold">{a.title}</p><p className="text-xs text-zinc-500">{a.course}</p></div><button onClick={()=>viewSubs(a)} className={`px-4 py-2 rounded-full text-xs font-black ${selectedAssign?.id===a.id?'bg-orange-600':'bg-zinc-800'}`}>Submissions</button></div>)}</div>
        </div>
        <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px] h-fit sticky top-4">
          <h3 className="font-black mb-4">{selectedAssign?`Submissions: ${selectedAssign.title} (${subs.length})`:`Select assignment`}</h3>
          {subs.map(s=><div key={s.id} className="bg-black/60 border border-white/5 p-4 rounded-2xl mb-3"><div className="flex justify-between"><p className="font-bold text-sm">{s.users?.full_name} ({s.users?.email})</p><span className={`text-[10px] px-2 py-1 rounded-full ${s.status==='graded'?'bg-green-500/20 text-green-400':'bg-orange-500/20 text-orange-400'}`}>{s.status}</span></div><a href={s.file_url} target="_blank" className="bg-zinc-800 px-3 py-1.5 rounded-full text-xs mt-2 inline-block">Download Answer</a><div className="grid grid-cols-3 gap-2 mt-3"><input id={`g-${s.id}`} defaultValue={s.grade??""} type="number" placeholder="Grade" className="bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white"/><input id={`f-${s.id}`} defaultValue={s.feedback||""} placeholder="Feedback" className="col-span-2 bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white"/></div><button onClick={async()=>{ const g=document.getElementById(`g-${s.id}`).value; const f=document.getElementById(`f-${s.id}`).value; await supabase.from('submissions').update({grade:parseInt(g), feedback:f, status:'graded'}).eq('id', s.id); alert('Graded!'); viewSubs(selectedAssign); }} className="w-full mt-2 bg-orange-600 py-2.5 rounded-xl text-sm font-black">Save Grade</button></div>)}
          {selectedAssign && subs.length===0 && <p className="text-zinc-500 text-sm py-10 text-center">No submissions yet</p>}
        </div>
      </div>
    </div>
  )
}

function StudentDash({user, profile}){
  const [classInfo,setClassInfo]=useState(null); const [faculty,setFaculty]=useState(null); const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState({}); const [uploadingId,setUploadingId]=useState(null);
  const load=async()=>{
    if(profile.class_id){
      const {data:c}=await supabase.from('classes').select('*').eq('id',profile.class_id).single(); if(c){ setClassInfo(c); if(c.faculty_id){ const {data:f}=await supabase.from('users').select('email,full_name').eq('id',c.faculty_id).single(); if(f) setFaculty(f) } }
      const {data:a}=await supabase.from('assignments').select('*').or(`class_id.eq.${profile.class_id},class_id.is.null`).order('due_date'); if(a) setAssignments(a);
    }
    const {data:subs}=await supabase.from('submissions').select('*').eq('student_id', user.id); const m={}; subs?.forEach(s=>m[s.assignment_id]=s); setMySubs(m);
  }
  useEffect(()=>{ load() },[profile.class_id])
  const submitWork=async(assign, file)=>{
    if(!file) return; setUploadingId(assign.id);
    const path=`submissions/${assign.id}/${user.id}_${Date.now()}_${file.name}`;
    await supabase.storage.from('mars-files').upload(path, file);
    const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl;
    await supabase.from('submissions').upsert({assignment_id:assign.id, student_id:user.id, file_url:url, status:'submitted', submitted_at: new Date().toISOString()}, {onConflict:'assignment_id,student_id'});
    setUploadingId(null); alert('Submitted!'); load();
  }
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-xs uppercase text-zinc-500">My Class</p><p className="text-xl font-black text-orange-400">{classInfo?.name||'Not assigned'}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-xs uppercase text-zinc-500">My Faculty</p><p className="font-black">{faculty?.full_name||faculty?.email||'Unassigned'}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-xs uppercase text-zinc-500">Assignments</p><p className="text-3xl font-black">{assignments.length}</p><p className="text-xs text-zinc-500">{Object.keys(mySubs).length} submitted</p></div>
      </div>
      <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">My Assignments</h3>
        <div className="grid gap-3">
          {assignments.map(a=>{
            const sub=mySubs[a.id];
            return (
              <div key={a.id} className="bg-black/50 border border-white/5 p-5 rounded-2xl">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div><p className="font-bold text-white">{a.title} <span className="text-zinc-500 text-xs ml-2">{a.course}</span></p><p className="text-xs text-zinc-500 mt-1">Due {a.due_date? new Date(a.due_date).toLocaleString(): ''}</p></div>
                  <div className="flex gap-2">{a.attachment_url && <a href={a.attachment_url} target="_blank" className="bg-zinc-800 px-4 py-2 rounded-full text-xs font-bold">Download Q</a>}{sub?.file_url && <a href={sub.file_url} target="_blank" className="bg-orange-600/20 text-orange-400 border border-orange-500/20 px-4 py-2 rounded-full text-xs font-bold">My Answer</a>}</div>
                </div>
                <div className="mt-4 bg-zinc-900/80 border border-white/5 p-4 rounded-2xl">
                  {sub? (<div><div className="flex gap-2 items-center"><span className={`text-xs px-3 py-1 rounded-full font-bold ${sub.status==='graded'?'bg-green-500/20 text-green-400':'bg-orange-500/20 text-orange-400'}`}>{sub.status==='graded'?`GRADED ${sub.grade}/100`:'SUBMITTED ✓'}</span><span className="text-xs text-zinc-500">{new Date(sub.submitted_at).toLocaleString()}</span></div>{sub.status==='graded' && <div className="mt-3 bg-green-500/10 border border-green-500/20 p-3 rounded-xl"><p className="text-green-400 font-black">Grade: {sub.grade}/100</p><p className="text-sm text-zinc-300 mt-1">Feedback: {sub.feedback||'No feedback'}</p></div>}<div className="mt-3 flex gap-2"><input type="file" onChange={e=>submitWork(a, e.target.files[0])} className="text-xs file:bg-zinc-800 file:text-white file:border-0 file:px-3 file:py-1.5 file:rounded-full bg-black/40 border border-white/5 p-1 rounded-full flex-1"/><span className="text-[10px] text-zinc-500">Resubmit</span></div></div>) : (<div>{uploadingId===a.id? <p className="text-orange-400 text-sm animate-pulse">Uploading...</p> : <div className="flex gap-2 items-center"><input type="file" onChange={e=>submitWork(a, e.target.files[0])} className="text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-full file:font-bold bg-zinc-800 border border-white/10 p-1 rounded-full w-full"/><span className="text-xs text-zinc-500">Upload PDF</span></div>}</div>)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LoginForm({type}){
  const [loading,setLoading]=useState(false)
  const inputLight="w-full bg-slate-100 text-black p-4 rounded-2xl placeholder:text-zinc-500 outline-none border-2 border-transparent focus:border-orange-500"
  const inputDark="w-full bg-zinc-800 border border-white/20 p-3.5 rounded-2xl text-white placeholder:text-zinc-500 outline-none focus:border-orange-500"
  const handleLogin=async(e)=>{ e.preventDefault(); setLoading(true); const {error}=await supabase.auth.signInWithPassword({email:e.target.email.value,password:e.target.password.value}); if(error) alert(error.message); setLoading(false) }
  const handleSignup=async(e)=>{ e.preventDefault(); setLoading(true); const {data,error}=await supabase.auth.signUp({ email:e.target.email.value, password:e.target.password.value, options:{ data:{ full_name:e.target.fullname.value, role:e.target.role.value } } }); if(error) alert(error.message); else alert('Account created as '+e.target.role.value.toUpperCase()+'! Wait for approval'); setLoading(false) }
  if(type==='login'){ return <form onSubmit={handleLogin} className="space-y-3"><input name="email" placeholder="Email" className={inputLight} required/><input name="password" type="password" placeholder="Password" className={inputLight} required/><button disabled={loading} className="w-full bg-orange-600 p-4 rounded-2xl font-black text-black">{loading?'Loading...':'LOGIN'}</button></form> }
  return (<form onSubmit={handleSignup} className="mt-3 space-y-3 bg-zinc-800/50 p-4 rounded-[24px] border border-white/10"><input name="fullname" placeholder="Full Name" className={inputDark} required/><input name="email" placeholder="Email" className={inputDark} required/><input name="password" type="password" placeholder="Password" className={inputDark} required/><select name="role" className={inputDark}><option value="student">Student</option><option value="faculty">Faculty / Teacher</option><option value="parent">Parent</option></select><button disabled={loading} className="w-full bg-white text-black p-3.5 rounded-2xl font-bold">{loading?'Creating...':'Sign Up'}</button></form>)
}

export default function AppWrapper(){
  const [user,setUser]=useState(null), [profile,setProfile]=useState(null), [loading,setLoading]=useState(true)
  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{ if(data.session) setUser(data.session.user); setLoading(false) }); supabase.auth.onAuthStateChange((_,s)=>{ setUser(s?.user||null); setLoading(false) }) },[])
  useEffect(()=>{ if(!user) return; supabase.from('users').select('*').eq('id',user.id).single().then(({data})=>{ if(!data){ const isSuper=user.email==='admin1@mars.com'; const pickedRole=(user.user_metadata?.role||'student').toLowerCase().trim(); const finalRole=isSuper?'super_admin':pickedRole; const newUser={id:user.id,email:user.email,role:finalRole,full_name:user.user_metadata?.full_name||'',is_active:isSuper}; supabase.from('users').insert(newUser).select().single().then(({data:d})=>setProfile(d||newUser)) } else setProfile(data) }) },[user])
  if(loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>
  if(!user) return <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4"><div className="bg-zinc-900/80 p-8 rounded-[32px] w-full max-w-md border border-white/10"><h1 className="text-4xl font-black mb-1"><span className="text-orange-500">MARS</span> <span className="text-white">E-School</span></h1><p className="text-zinc-500 text-sm mb-8">Modern Learning OS</p><LoginForm type="login"/><details className="mt-6"><summary className="text-zinc-400 text-sm cursor-pointer">Create account</summary><LoginForm type="signup"/></details></div></div>
  let role=(profile?.role||'').toLowerCase(); if(user.email==='admin1@mars.com') role='super_admin'
  const isActive=profile?.is_active || role==='super_admin'
  const isAdmin=['super_admin','school_admin'].includes(role)
  const isFaculty=['faculty','teacher'].includes(role)
  if(!isActive) return <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center"><div className="bg-zinc-900 border border-orange-500/20 p-10 rounded-[32px] max-w-md"><h2 className="text-2xl font-black mb-2 text-white">Access Pending</h2><p className="text-zinc-400">Hi {user.email} as {role.toUpperCase()} waiting</p><button onClick={()=>supabase.auth.signOut()} className="mt-6 bg-zinc-800 px-6 py-3 rounded-full text-white">Logout</button></div></div>
  return <div className="min-h-screen bg-[#080808] text-white p-4 md:p-8"><header className="flex justify-between items-center mb-8 bg-zinc-900/60 p-3 pl-6 rounded-full border border-white/10"><h1 className="text-xs md:text-sm font-black"><span className="text-orange-500">MARS</span> • {user.email} • {role.toUpperCase()}</h1><button onClick={()=>supabase.auth.signOut()} className="bg-white text-black px-5 py-2 rounded-full font-bold text-sm">Logout</button></header>{isAdmin? <AdminDash/> : isFaculty? <FacultyDash user={user} profile={profile}/> : <StudentDash user={user} profile={profile}/>}</div>
}