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
    <div className="space-y-6 max-w-[1300px] mx-auto">
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
      {tab==="approvals" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><h3 className="font-black text-lg">New Accounts Waiting</h3><div className="grid gap-3 mt-4">{pending.length===0 && <p className="text-center py-10 text-zinc-500">No pending</p>}{pending.map(u=>(<div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between gap-3 flex-wrap"><div><p className="font-bold">{u.email}</p><p className="text-xs text-zinc-400">{u.full_name} - <span className="text-orange-400 font-bold">{u.role}</span></p></div><div className="flex gap-2"><select id={`c-${u.id}`} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-sm text-white"><option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={async()=>{ const cid=document.getElementById(`c-${u.id}`).value||null; await supabase.from('users').update({is_active:true, class_id:cid}).eq('id',u.id); load()}} className="bg-green-600 px-4 py-2 rounded-xl text-sm font-bold">Approve</button><button onClick={async()=>{ await supabase.from('users').delete().eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-2 rounded-xl text-sm">Reject</button></div></div>))}</div></div>)}
      {tab==="users" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6 overflow-auto"><table className="w-full text-sm min-w-[900px]"><thead><tr className="text-zinc-500 text-xs uppercase"><th className="text-left p-3">USER</th><th>ROLE</th><th>CLASS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t border-white/5"><td className="p-3 font-bold">{u.email}<p className="text-xs text-zinc-500">{u.full_name}</p></td><td><select value={(u.role||'').toLowerCase()} onChange={async(e)=>{await supabase.from('users').update({role:e.target.value}).eq('id',u.id); load()}} className="bg-black border border-white/10 p-2 rounded-xl text-xs text-white"><option value="student">student</option><option value="faculty">faculty</option><option value="teacher">teacher</option><option value="school_admin">school_admin</option><option value="super_admin">super_admin</option></select></td><td><select value={u.class_id||''} onChange={async(e)=>{await supabase.from('users').update({class_id:e.target.value||null}).eq('id',u.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white min-w-[160px]"><option value="">- No Class -</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td><td>{u.is_active?<span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Active</span>:<span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">Pending</span>}</td><td className="flex gap-1 p-2"><button onClick={async()=>{await supabase.from('users').update({is_active:!u.is_active}).eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-1 rounded-xl text-xs">{u.is_active?'Revoke':'Approve'}</button></td></tr>)}</tbody></table></div>)}
      {tab==="classes" && (<div className="grid lg:grid-cols-2 gap-6"><div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Create Class + Assign Faculty</h3><input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Form 1A" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white placeholder:text-zinc-500"/><select value={classForm.faculty_id} onChange={e=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"><option value="">Select Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email} - {f.full_name}</option>)}</select><button onClick={async()=>{ if(!classForm.name) return; await supabase.from('classes').insert({name:classForm.name, faculty_id:classForm.faculty_id||null}); setClassForm({name:"",faculty_id:""}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">Create Class</button><div className="mt-6 space-y-2">{classes.map(c=><div key={c.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between"><div><p className="font-bold">{c.name}</p><p className="text-xs text-zinc-500">{users.filter(u=>u.class_id===c.id).length} students - {facultyList.find(f=>f.id===c.faculty_id)?.email||'No faculty'}</p></div><select value={c.faculty_id||''} onChange={async(e)=>{await supabase.from('classes').update({faculty_id:e.target.value||null}).eq('id',c.id); load()}} className="bg-zinc-800 text-xs p-2 rounded-xl text-white"><option value="">Assign</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email}</option>)}</select></div>)}</div></div><div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Roster</h3>{classes.map(c=><div key={c.id} className="mb-6"><p className="font-bold text-orange-400">{c.name} → {facultyList.find(f=>f.id===c.faculty_id)?.email||'No teacher'}</p>{users.filter(u=>u.class_id===c.id).map(u=><div key={u.id} className="text-sm bg-black/40 p-2 rounded-xl mt-1 flex justify-between"><span>{u.email} ({u.role})</span><span className="text-xs text-zinc-500">{u.full_name}</span></div>)}{users.filter(u=>u.class_id===c.id).length===0 && <p className="text-xs text-zinc-600 mt-1">No students</p>}</div>)}</div></div>)}
      {tab==="assignments" && (<div className="grid lg:grid-cols-2 gap-6"><div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]"><h3 className="font-black mb-4">Publish Assignment</h3><div className="space-y-3"><input value={assignForm.title} onChange={e=>setAssignForm({...assignForm,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/><div className="grid grid-cols-2 gap-3"><input value={assignForm.course} onChange={e=>setAssignForm({...assignForm,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/><select value={assignForm.class_id} onChange={e=>setAssignForm({...assignForm,class_id:e.target.value})} className="bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">All Classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><input type="datetime-local" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><input type="file" onChange={e=>setAssignForm({...assignForm,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/><button disabled={uploading} onClick={async()=>{ if(!assignForm.title||!assignForm.due_date) return alert('Title & Due date needed'); setUploading(true); let url=null; if(assignForm.file){ const path=`${Date.now()}_${assignForm.file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path, assignForm.file); if(error){ alert('Upload failed: '+error.message); setUploading(false); return;} url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl } const {data:ses}=await supabase.auth.getUser(); const {error}=await supabase.from('assignments').insert({title:assignForm.title,course:assignForm.course,due_date:assignForm.due_date,class_id:assignForm.class_id||null,attachment_url:url, created_by: ses.user.id}); if(error) alert(error.message); else alert('Published!'); setUploading(false); setAssignForm({title:"",course:"",due_date:"",class_id:"",file:null}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">{uploading?'Publishing...':'Publish'}</button></div></div><div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Assignments ({assignments.length})</h3>{assignments.map(a=><div key={a.id} className="bg-black/40 p-3 rounded-xl mb-2 text-sm flex justify-between items-center"><span>{a.title} - {classes.find(c=>c.id===a.class_id)?.name||'All'} <span className="text-orange-400 ml-2">{subCount[a.id]?`${subCount[a.id]} subs`:''}</span></span>{a.attachment_url && <a href={a.attachment_url} target="_blank" className="text-orange-400 underline">File</a>}</div>)}{assignments.length===0 && <p className="text-zinc-600 text-sm">No assignments yet</p>}</div></div>)}
    </div>
  )
}

function FacultyDash({user, profile}){
  const [myClasses,setMyClasses]=useState([]); const [students,setStudents]=useState([]); const [assignments,setAssignments]=useState([]);
  const [form,setForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [tab,setTab]=useState("roster");
  const [selectedAssign,setSelectedAssign]=useState(null); const [subs,setSubs]=useState([]); const [loadingSubs,setLoadingSubs]=useState(false); const [search,setSearch]=useState("");

  const load=async()=>{
    const {data:c}=await supabase.from('classes').select('*').eq('faculty_id',user.id);
    if(c){
      setMyClasses(c);
      if(c.length &&!form.class_id) setForm(f=>({...f, class_id:c[0].id}));
      const ids=c.map(x=>x.id);
      if(ids.length){
        const {data:u}=await supabase.from('users').select('*').in('class_id',ids);
        if(u) setStudents(u);
      }
    }
    const {data:as}=await supabase.from('assignments').select('*').eq('created_by', user.id).order('created_at',{ascending:false});
    if(as) setAssignments(as);
  }
  useEffect(()=>{ load() },[user.id])

  const viewSubs=async(assign)=>{
    setSelectedAssign(assign); setLoadingSubs(true);
    const {data}=await supabase.from('submissions').select('*, users!submissions_student_id_fkey(full_name,email)').eq('assignment_id', assign.id).order('submitted_at',{ascending:false});
    setSubs(data||[]); setLoadingSubs(false);
  }

  const stats = {
    classes: myClasses.length,
    students: students.length,
    assignments: assignments.length,
    toGrade: subs.filter(s=>s.status==='submitted').length,
    allSubs: subs.length
  }

  const filteredAssignments = assignments.filter(a=>{
    if(search &&!a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  })

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="bg-gradient-to-br from-orange-600/20 via-zinc-900/70 to-zinc-900 border border-orange-500/20 p-6 rounded-[24px] flex justify-between flex-wrap gap-4">
        <div><h2 className="text-2xl font-black">Welcome, {profile.full_name||user.email.split('@')[0]}</h2><p className="text-zinc-400 mt-1">Teaching <span className="text-orange-400 font-bold">{myClasses.map(c=>c.name).join(', ')||'No class assigned'}</span> • {students.length} students • {assignments.length} assignments</p></div>
        <div className="flex gap-2"><div className="bg-black/40 border border-white/5 px-4 py-2 rounded-2xl text-center"><p className="text-[10px] uppercase text-zinc-500">To Grade</p><p className="text-xl font-black text-orange-400">{stats.toGrade}</p></div><div className="bg-black/40 border border-white/5 px-4 py-2 rounded-2xl text-center"><p className="text-[10px] uppercase text-zinc-500">Students</p><p className="text-xl font-black">{stats.students}</p></div></div>
      </div>

      <div className="bg-zinc-900/70 border border-white/10 p-2 rounded-[24px] flex flex-wrap justify-between gap-2">
        <div className="flex gap-1 bg-black/40 p-1 rounded-full">
          {[
            {id:"roster", l:`Roster (${stats.students})`},
            {id:"create", l:"Create"},
            {id:"assignments", l:`Assignments (${stats.assignments})`},
            {id:"grading", l:`To Grade ${selectedAssign?`• ${selectedAssign.title}`:''}`}
          ].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${tab===t.id?'bg-white text-black':'text-zinc-400 hover:text-white'}`}>{t.l}</button>)}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="bg-black/40 border border-white/5 px-4 py-2 rounded-full text-sm w-[180px] text-white placeholder:text-zinc-600 outline-none"/>
      </div>

      {tab==="roster" && (
        <div className="grid lg:grid-cols-3 gap-4">
          {myClasses.map(c=>(
            <div key={c.id} className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]">
              <div className="flex justify-between"><p className="font-black text-orange-400 text-lg">{c.name}</p><span className="bg-black/50 border border-white/5 px-3 py-1 rounded-full text-xs">{students.filter(s=>s.class_id===c.id).length} students</span></div>
              <div className="mt-4 space-y-2 max-h-[400px] overflow-auto">
                {students.filter(s=>s.class_id===c.id).map(s=>(
                  <div key={s.id} className="bg-black/40 border border-white/5 p-3 rounded-2xl flex justify-between items-center group hover:border-white/10 transition">
                    <div><p className="font-bold text-sm">{s.full_name||s.email.split('@')[0]}</p><p className="text-xs text-zinc-500">{s.email}</p></div>
                    <span className={`text-[10px] px-2 py-1 rounded-full ${s.is_active?'bg-green-500/20 text-green-400':'bg-orange-500/20 text-orange-400'}`}>{s.is_active?'Active':'Pending'}</span>
                  </div>
                ))}
                {students.filter(s=>s.class_id===c.id).length===0 && <p className="text-sm text-zinc-600 text-center py-10">No students in {c.name} yet. Admin must assign students to this class.</p>}
              </div>
            </div>
          ))}
          {myClasses.length===0 && <div className="col-span-3 bg-zinc-900/50 border border-dashed border-white/10 p-16 rounded-[32px] text-center"><p className="font-black">No class assigned</p><p className="text-sm text-zinc-500 mt-1">Ask super_admin to set your faculty_id in classes table</p></div>}
        </div>
      )}

      {tab==="create" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px] h-fit">
            <h3 className="font-black mb-5 text-lg">New Assignment</h3>
            <div className="space-y-4">
              <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title e.g. Algebra Test 1" className="w-full bg-zinc-800 border border-white/10 p-4 rounded-2xl text-white placeholder:text-zinc-500 outline-none focus:border-orange-500/50"/>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.course} onChange={e=>setForm({...form,course:e.target.value})} placeholder="Course e.g Maths" className="w-full bg-zinc-800 border border-white/10 p-4 rounded-2xl text-white placeholder:text-zinc-500 outline-none"/>
                <select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-4 rounded-2xl text-white outline-none"><option value="">Select Class</option>{myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <input type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-4 rounded-2xl text-white outline-none"/>
              <div className="bg-black/40 border border-dashed border-white/10 p-4 rounded-2xl"><p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Attachment (optional)</p><input type="file" onChange={e=>setForm({...form,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-full bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/></div>
              <button onClick={async()=>{ if(!form.title||!form.class_id) return alert('Title & Class required'); let url=null; if(form.file){ const path=`${Date.now()}_${form.file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path,form.file); if(error) return alert(error.message); url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl } const {error}=await supabase.from('assignments').insert({title:form.title,course:form.course,due_date:form.due_date,class_id:form.class_id,attachment_url:url, created_by:user.id}); if(error) alert(error.message); else { alert('Published to '+myClasses.find(c=>c.id===form.class_id)?.name); setForm({title:"",course:"",due_date:"",class_id:myClasses[0]?.id||"",file:null}); load(); } }} className="w-full bg-orange-600 py-4 rounded-2xl font-black text-[15px] hover:bg-orange-500 transition">Publish to Class</button>
            </div>
          </div>
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]">
            <h3 className="font-black mb-4">Recent Assignments</h3>
            <div className="space-y-3">
              {assignments.slice(0,6).map(a=>(
                <div key={a.id} className="bg-black/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center hover:border-white/10 transition">
                  <div><p className="font-bold">{a.title}</p><p className="text-xs text-zinc-500 mt-1">{myClasses.find(c=>c.id===a.class_id)?.name||'All'} • Due {a.due_date? new Date(a.due_date).toLocaleDateString() : 'No due'} • {a.course}</p></div>
                  <button onClick={()=>{ viewSubs(a); setTab("grading"); }} className="bg-zinc-800 px-4 py-2 rounded-full text-xs font-bold hover:bg-white hover:text-black transition">Grade</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="assignments" && (
        <div className="grid gap-3">
          {filteredAssignments.map(a=>(
            <div key={a.id} className="bg-zinc-900/70 border border-white/10 p-5 rounded-[24px] flex justify-between items-center flex-wrap gap-3 hover:border-white/20 transition">
              <div className="flex gap-4 items-center"><div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-white/5 flex items-center justify-center font-black">{a.title[0]}</div><div><p className="font-black">{a.title} <span className="text-zinc-500 font-normal text-xs ml-2">{a.course}</span></p><p className="text-xs text-zinc-500 mt-1">{myClasses.find(c=>c.id===a.class_id)?.name} • Due {a.due_date? new Date(a.due_date).toLocaleString():''} • {a.attachment_url? 'Has file' : 'No file'}</p></div></div>
              <div className="flex gap-2"><a href={a.attachment_url} target="_blank" className={`px-4 py-2 rounded-full text-xs font-bold border ${a.attachment_url?'bg-zinc-800 border-white/5':'bg-black/20 border-white/5 text-zinc-600'}`}>File</a><button onClick={()=>{ viewSubs(a); setTab("grading"); }} className="bg-white text-black px-5 py-2 rounded-full text-xs font-black">Submissions</button></div>
            </div>
          ))}
          {filteredAssignments.length===0 && <p className="text-center py-16 text-zinc-600">No assignments yet — create one in Create tab</p>}
        </div>
      )}

      {tab==="grading" && (
        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[24px] h-fit">
            <h3 className="font-black mb-4">Select Assignment</h3>
            <div className="space-y-2 max-h-[70vh] overflow-auto">
              {assignments.map(a=>(
                <button key={a.id} onClick={()=>viewSubs(a)} className={`w-full text-left p-4 rounded-2xl border transition ${selectedAssign?.id===a.id?'bg-orange-600 border-orange-500 text-white':'bg-black/40 border-white/5 hover:border-white/10'}`}>
                  <p className="font-bold text-sm">{a.title}</p><p className="text-xs opacity-70 mt-1">{myClasses.find(c=>c.id===a.class_id)?.name} • {new Date(a.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]">
            <div className="flex justify-between items-center mb-6"><h3 className="font-black text-lg">{selectedAssign? `${selectedAssign.title} — ${subs.length} submissions` : 'Select assignment to grade'}</h3>{selectedAssign && <span className="bg-black/50 border border-white/5 px-3 py-1 rounded-full text-xs">{subs.filter(s=>s.status==='submitted').length} pending • {subs.filter(s=>s.status==='graded').length} graded</span>}</div>
            {loadingSubs && <p className="text-zinc-500">Loading submissions...</p>}
            {!selectedAssign && <div className="border border-dashed border-white/10 p-16 rounded-[32px] text-center"><p className="text-4xl mb-3">📝</p><p className="font-bold">No assignment selected</p><p className="text-sm text-zinc-500 mt-1">Choose from left to see student work</p></div>}
            {selectedAssign && subs.length===0 &&!loadingSubs && <div className="border border-dashed border-white/10 p-16 rounded-[32px] text-center"><p className="font-bold">No submissions yet</p><p className="text-sm text-zinc-500 mt-1">Students in {myClasses.find(c=>c.id===selectedAssign.class_id)?.name} haven't submitted for {selectedAssign.title}</p></div>}
            <div className="grid md:grid-cols-2 gap-4">
              {subs.map(s=>(
                <div key={s.id} className="bg-black/60 border border-white/5 p-5 rounded-[24px] hover:border-white/10 transition">
                  <div className="flex justify-between items-start"><div><p className="font-black">{s.users?.full_name||s.users?.email?.split('@')[0]}</p><p className="text-xs text-zinc-500">{s.users?.email}</p></div><span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${s.status==='graded'?'bg-green-500/20 text-green-400 border border-green-500/20':'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>{s.status.toUpperCase()}{s.grade!=null?` ${s.grade}/100`:''}</span></div>
                  <div className="flex gap-2 mt-4"><a href={s.file_url} target="_blank" className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-white/5 px-4 py-2.5 rounded-full text-xs font-bold text-center transition">Download Answer</a><span className="bg-black/50 border border-white/5 px-3 py-2.5 rounded-full text-[10px] text-zinc-500">{new Date(s.submitted_at).toLocaleDateString()}</span></div>
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2"><input id={`g-${s.id}`} defaultValue={s.grade??""} type="number" min="0" max="100" placeholder="Grade" className="col-span-1 bg-zinc-800 border border-white/10 p-3 rounded-2xl text-sm text-white outline-none focus:border-orange-500/50"/><input id={`f-${s.id}`} defaultValue={s.feedback||""} placeholder="Feedback for student..." className="col-span-2 bg-zinc-800 border border-white/10 p-3 rounded-2xl text-sm text-white outline-none focus:border-orange-500/50"/></div>
                    <button onClick={async()=>{ const grade=document.getElementById(`g-${s.id}`).value; const fb=document.getElementById(`f-${s.id}`).value; if(grade==="") return alert("Enter grade 0-100"); const {error}=await supabase.from('submissions').update({grade:parseInt(grade), feedback:fb, status:'graded'}).eq('id', s.id); if(error) alert(error.message); else { viewSubs(selectedAssign); } }} className="w-full bg-white text-black py-3 rounded-2xl text-sm font-black hover:bg-zinc-200 transition">Save Grade</button>
                    {s.grade!=null && <p className="text-xs text-zinc-500">Current: {s.grade}/100 — {s.feedback||'No feedback'}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StudentDash({user, profile}){
  const [classInfo,setClassInfo]=useState(null); const [faculty,setFaculty]=useState(null); const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState({}); const [uploadingId,setUploadingId]=useState(null); const [tab,setTab]=useState("all"); const [search,setSearch]=useState("");
  const load=async()=>{
    if(profile.class_id){
      const {data:c}=await supabase.from('classes').select('*').eq('id',profile.class_id).single();
      if(c){ setClassInfo(c); if(c.faculty_id){ const {data:f}=await supabase.from('users').select('email,full_name').eq('id',c.faculty_id).single(); if(f) setFaculty(f) } }
      const {data:a}=await supabase.from('assignments').select('*').or(`class_id.eq.${profile.class_id},class_id.is.null`).order('due_date', {ascending:true}); if(a) setAssignments(a);
    } else {
      const {data:a}=await supabase.from('assignments').select('*').is('class_id', null).order('due_date'); if(a) setAssignments(a);
    }
    const {data:subs}=await supabase.from('submissions').select('*').eq('student_id', user.id); const m={}; subs?.forEach(s=>m[s.assignment_id]=s); setMySubs(m);
  }
  useEffect(()=>{ load() },[profile.class_id])
  const submitWork=async(assign, file)=>{
    if(!file) return; setUploadingId(assign.id);
    const path=`submissions/${assign.id}/${user.id}_${Date.now()}_${file.name}`;
    const {error:upErr}=await supabase.storage.from('mars-files').upload(path, file);
    if(upErr){ alert(upErr.message); setUploadingId(null); return; }
    const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl;
    await supabase.from('submissions').upsert({assignment_id:assign.id, student_id:user.id, file_url:url, status:'submitted', submitted_at: new Date().toISOString()}, {onConflict:'assignment_id,student_id'});
    setUploadingId(null); load();
  }
  const getStatus = (a) => { const sub = mySubs[a.id]; if(!sub) return "pending"; return sub.status; }
  const filtered = assignments.filter(a=>{
    if(search &&!a.title.toLowerCase().includes(search.toLowerCase()) &&!a.course?.toLowerCase().includes(search.toLowerCase())) return false;
    const s = getStatus(a);
    if(tab==="all") return true;
    if(tab==="todo") return s==="pending";
    if(tab==="submitted") return s==="submitted";
    if(tab==="graded") return s==="graded";
    return true;
  })
  const stats = { total: assignments.length, todo: assignments.filter(a=>!mySubs[a.id]).length, submitted: Object.values(mySubs).filter(s=>s.status==='submitted').length, graded: Object.values(mySubs).filter(s=>s.status==='graded').length, avg: (()=>{ const g=Object.values(mySubs).filter(s=>s.grade!=null).map(s=>s.grade); return g.length? Math.round(g.reduce((a,b)=>a+b,0)/g.length) : 0 })() }
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase tracking-widest text-zinc-500">My Class</p><p className="text-xl font-black text-orange-400 mt-1">{classInfo?.name||'Not assigned'}</p><p className="text-xs text-zinc-600 mt-1">{stats.total} assignments</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase tracking-widest text-zinc-500">My Faculty</p><p className="font-bold mt-1">{faculty?.full_name||faculty?.email?.split('@')[0]||'Unassigned'}</p><p className="text-xs text-zinc-500">{faculty?.email||''}</p></div>
        <div className="bg-zinc-900/70 border border-orange-500/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Progress</p><div className="flex gap-2 items-end mt-1"><p className="text-3xl font-black">{stats.total? Math.round(((stats.submitted+stats.graded)/stats.total)*100):0}%</p><p className="text-xs text-zinc-500 mb-1">{stats.submitted+stats.graded}/{stats.total} done</p></div><div className="w-full bg-black/50 h-1.5 rounded-full mt-3"><div className="bg-orange-600 h-1.5 rounded-full" style={{width:`${stats.total? ((stats.submitted+stats.graded)/stats.total)*100:0}%`}}></div></div></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Average Grade</p><p className="text-3xl font-black mt-1">{stats.avg? `${stats.avg}%` : '--'}</p><p className="text-xs text-zinc-500 mt-1">{stats.graded} graded • {stats.todo} todo</p></div>
      </div>
      <div className="bg-zinc-900/70 border border-white/10 p-2 rounded-[24px] flex flex-wrap justify-between gap-2">
        <div className="flex gap-1 bg-black/40 p-1 rounded-full">
          {[{id:"all", l:`All (${stats.total})`},{id:"todo", l:`To Do (${stats.todo})`},{id:"submitted", l:`Submitted (${stats.submitted})`},{id:"graded", l:`Graded (${stats.graded})`}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${tab===t.id?'bg-white text-black':'text-zinc-400 hover:text-white'}`}>{t.l}</button>)}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assignments..." className="bg-black/40 border border-white/5 px-4 py-2 rounded-full text-sm w-[200px] text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/50"/>
      </div>
      <div className="grid gap-4">
        {filtered.map(a=>{
          const sub=mySubs[a.id];
          const status=getStatus(a);
          const overdue = a.due_date && new Date(a.due_date) < new Date() && status==="pending";
          return (
            <div key={a.id} className={`group bg-zinc-900/70 border ${overdue?'border-red-500/30':'border-white/10'} p-0 rounded-[24px] overflow-hidden hover:border-white/20 transition`}>
              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${status==='graded'?'bg-green-500/20 text-green-400': status==='submitted'?'bg-orange-500/20 text-orange-400':'bg-zinc-800 text-zinc-400'}`}>{status==='graded'? `${sub.grade}` : status==='submitted'? '✓' : a.course?.[0]||'A'}</div>
                  <div><div className="flex gap-2 items-center flex-wrap"><p className="font-black text-white text-[16px]">{a.title}</p><span className="bg-black/50 border border-white/5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest text-zinc-400">{a.course||'General'}</span>{overdue && <span className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full text-[10px] font-bold">OVERDUE</span>}{status==='graded' && <span className="bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full text-[10px] font-bold">GRADED {sub.grade}/100</span>}{status==='submitted' && <span className="bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full text-[10px] font-bold">SUBMITTED</span>}</div><p className="text-xs text-zinc-500 mt-1.5">Due: {a.due_date? new Date(a.due_date).toLocaleString() : 'No due date'} • {sub? `Submitted ${new Date(sub.submitted_at).toLocaleString()}` : 'Not submitted yet'}</p>{status==='graded' && sub.feedback && <p className="text-sm bg-green-500/10 border border-green-500/20 p-2.5 rounded-xl mt-3 text-zinc-200"><span className="text-green-400 font-bold">Feedback:</span> {sub.feedback}</p>}</div>
                </div>
                <div className="flex gap-2 shrink-0">{a.attachment_url && <a href={a.attachment_url} target="_blank" className="bg-zinc-800 hover:bg-zinc-700 border border-white/5 px-5 py-2.5 rounded-full text-xs font-bold transition">Question</a>}{sub?.file_url && <a href={sub.file_url} target="_blank" className="bg-white text-black px-5 py-2.5 rounded-full text-xs font-bold hover:bg-zinc-200 transition">My Work</a>}</div>
              </div>
              <div className="bg-black/50 border-t border-white/5 p-3 px-6 flex justify-between items-center gap-3">
                {status==="pending"? (<div className="flex gap-3 items-center w-full"><label className="flex-1 flex items-center gap-3 bg-zinc-800/80 border border-white/10 px-3 py-2 rounded-full cursor-pointer hover:border-orange-500/30 transition"><span className="bg-orange-600 text-white px-4 py-1.5 rounded-full text-xs font-black">Choose File</span><span className="text-xs text-zinc-400 truncate">{uploadingId===a.id? 'Uploading...' : 'PDF, DOC, Image'}</span><input type="file" className="hidden" onChange={e=>submitWork(a, e.target.files[0])} /></label>{uploadingId===a.id && <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>}</div>) : status==="submitted"? (<div className="flex justify-between w-full items-center"><p className="text-xs text-zinc-500">✓ Submitted — waiting for grading. You can resubmit to replace.</p><label className="bg-zinc-800 border border-white/10 px-4 py-1.5 rounded-full text-xs cursor-pointer hover:bg-zinc-700">Resubmit<input type="file" className="hidden" onChange={e=>submitWork(a, e.target.files[0])}/></label></div>) : (<div className="flex justify-between w-full items-center"><p className="text-xs text-green-400 font-bold">✓ Graded: {sub.grade}/100 {sub.grade>=80?'🎉 Excellent': sub.grade>=60?'👍 Good':'📚 Keep improving'}</p><label className="bg-zinc-800 border border-white/10 px-4 py-1.5 rounded-full text-xs cursor-pointer hover:bg-zinc-700">Resubmit for re-grade<input type="file" className="hidden" onChange={e=>submitWork(a, e.target.files[0])}/></label></div>)}
              </div>
            </div>
          )
        })}
        {filtered.length===0 && <div className="bg-zinc-900/50 border border-dashed border-white/10 p-16 rounded-[32px] text-center"><p className="text-5xl mb-4">📚</p><p className="font-black">No assignments in {tab}</p><p className="text-sm text-zinc-500 mt-1">{tab==="todo"? "All caught up! 🎉" : tab==="graded"? "No grades yet — submit work to get graded" : "Try another tab"}</p></div>}
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