import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App(){
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authForm, setAuthForm] = useState({email:"", password:"", full_name:"", role:"student"});
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ if(data.session) setUser(data.session.user) });
    const {data: sub} = supabase.auth.onAuthStateChange((_e,s)=> setUser(s?.user||null));
    return ()=> sub.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!user){ setProfile(null); setLoading(false); return; }
    (async()=>{
      const {data} = await supabase.from("users").select("*").eq("id", user.id).single();
      setProfile(data||null);
      setLoading(false);
    })();
  },[user]);

  if(loading) return <div style={{padding:40}}>Loading Mars...</div>;
  if(!user) return <AuthScreen authForm={authForm} setAuthForm={setAuthForm} isSignUp={isSignUp} setIsSignUp={setIsSignUp} setUser={setUser} />;
  if(profile &&!profile.is_active) return <div style={{padding:40}}><h2>Pending Approval</h2><p>Your account {profile.email} is waiting for admin approval.</p><button onClick={()=>supabase.auth.signOut()}>Logout</button></div>;
  if(!profile) return <div style={{padding:40}}>Creating profile... <button onClick={()=>supabase.auth.signOut()}>Logout</button></div>;

  return (
    <div style={{fontFamily:"system-ui", background:"#f5f7fb", minHeight:"100vh"}}>
      <header style={{display:"flex", justifyContent:"space-between", padding:"12px 20px", background:"white", borderBottom:"1px solid #ddd"}}>
        <b>MARS e-School • {profile.role} • {profile.full_name}</b>
        <div><span style={{marginRight:12}}>{profile.email}</span><button onClick={()=>supabase.auth.signOut()}>Logout</button></div>
      </header>
      {["super_admin","school_admin"].includes(profile.role) && <AdminDash user={user} profile={profile} />}
      {profile.role==="faculty" && <FacultyDash user={user} profile={profile} />}
      {profile.role==="student" && <StudentDash user={user} profile={profile} />}
      {profile.role==="parent" && <StudentDash user={user} profile={profile} isParent />}
    </div>
  );
}

function AuthScreen({authForm, setAuthForm, isSignUp, setIsSignUp, setUser}){
  async function handleAuth(e){
    e.preventDefault();
    if(isSignUp){
      const {data, error} = await supabase.auth.signUp({email:authForm.email, password:authForm.password});
      if(error) return alert(error.message);
      const uid = data.user?.id || data.session?.user?.id;
      if(uid){
        await supabase.from("users").insert({id:uid, email:authForm.email, full_name:authForm.full_name||authForm.email.split("@")[0], role:authForm.role, is_active: authForm.role==="student"?true:false});
        alert("Account created! If student, you can login now. If faculty/admin, wait for approval.");
        setIsSignUp(false);
      }
    } else {
      const {data, error} = await supabase.auth.signInWithPassword({email:authForm.email, password:authForm.password});
      if(error) return alert(error.message);
      setUser(data.user);
    }
  }
  return (
    <div style={{maxWidth:400, margin:"60px auto", background:"white", padding:24, borderRadius:12}}>
      <h2>Mars Login</h2>
      <form onSubmit={handleAuth} style={{display:"flex", flexDirection:"column", gap:10}}>
        {isSignUp && <>
          <input placeholder="Full Name" required value={authForm.full_name} onChange={e=>setAuthForm({...authForm, full_name:e.target.value})} />
          <select value={authForm.role} onChange={e=>setAuthForm({...authForm, role:e.target.value})}>
            <option value="student">Student</option><option value="faculty">Faculty</option><option value="parent">Parent</option><option value="school_admin">School Admin</option>
          </select>
        </>}
        <input placeholder="Email" required value={authForm.email} onChange={e=>setAuthForm({...authForm, email:e.target.value})} />
        <input placeholder="Password" type="password" required value={authForm.password} onChange={e=>setAuthForm({...authForm, password:e.target.value})} />
        <button type="submit">{isSignUp?"Sign Up":"Login"}</button>
      </form>
      <button style={{marginTop:10}} onClick={()=>setIsSignUp(!isSignUp)}>{isSignUp?"Have account? Login":"No account? Sign Up"}</button>
      <div style={{marginTop:12, fontSize:12, color:"#666"}}>Admin: admin1@mars.com | Faculty: tea4@gmail.com | Student: stu1@mars.com</div>
    </div>
  );
}

function AdminDash(){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([]);
  const [assignForm,setAssignForm]=useState({title:"", course:"", due_date:"", class_id:""});
  const [file,setFile]=useState(null);
  const [assignments,setAssignments]=useState([]);
  const [newClass,setNewClass]=useState({name:"", faculty_id:""});

  async function load(){
    const {data:u}=await supabase.from("users").select("*").order("created_at",{ascending:false});
    const {data:c}=await supabase.from("classes").select("*, users!classes_faculty_id_fkey(full_name,email)").order("created_at",{ascending:false});
    const {data:a}=await supabase.from("assignments").select("*").order("created_at",{ascending:false});
    setUsers(u||[]); setClasses(c||[]); setAssignments(a||[]);
  }
  useEffect(()=>{load()},[]);

  async function createClass(){
    if(!newClass.name) return alert("Class name required");
    const {error}=await supabase.from("classes").insert({name:newClass.name, faculty_id:newClass.faculty_id||null});
    if(error) alert(error.message); else { setNewClass({name:"", faculty_id:""}); load(); }
  }
  async function toggleActive(u){
    await supabase.from("users").update({is_active:!u.is_active}).eq("id",u.id); load();
  }
  async function assignClass(userId, classId){
    await supabase.from("users").update({class_id:classId||null}).eq("id",userId); load();
  }
  async function publish(){
    let url=null;
    if(file){
      const path=`assignments/${Date.now()}_${file.name}`;
      const {error} = await supabase.storage.from("mars-files").upload(path, file);
      if(error) return alert(error.message);
      url = supabase.storage.from("mars-files").getPublicUrl(path).data.publicUrl;
    }
    const {data: sess} = await supabase.auth.getUser();
    const {error}=await supabase.from("assignments").insert({
      title:assignForm.title, course:assignForm.course, due_date:assignForm.due_date||null,
      class_id:assignForm.class_id||null, attachment_url:url, created_by:sess.user.id
    });
    if(error) alert(error.message); else { alert("Published!"); setAssignForm({title:"",course:"",due_date:"",class_id:""}); setFile(null); load(); }
  }

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, padding:16}}>
      <div style={{background:"white", padding:12, borderRadius:8}}>
        <h3>Create Class</h3>
        <input placeholder="Class name e.g. Form1A" value={newClass.name} onChange={e=>setNewClass({...newClass, name:e.target.value})} />
        <select value={newClass.faculty_id} onChange={e=>setNewClass({...newClass, faculty_id:e.target.value})} style={{marginLeft:8}}>
          <option value="">-- Select Faculty --</option>
          {users.filter(u=>u.role==="faculty").map(f=><option key={f.id} value={f.id}>{f.full_name} ({f.email})</option>)}
        </select>
        <button onClick={createClass} style={{marginLeft:8}}>Create</button>
        <h4 style={{marginTop:16}}>Classes ({classes.length})</h4>
        {classes.map(c=><div key={c.id} style={{borderBottom:"1px solid #eee", padding:"6px 0"}}>{c.name} → {c.users?.full_name||c.users?.email||"No faculty"} </div>)}
      </div>
      <div style={{background:"white", padding:12, borderRadius:8}}>
        <h3>Publish Assignment</h3>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          <input placeholder="Title e.g. Intro" value={assignForm.title} onChange={e=>setAssignForm({...assignForm, title:e.target.value})} />
          <input placeholder="Course" value={assignForm.course} onChange={e=>setAssignForm({...assignForm, course:e.target.value})} />
          <input type="date" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm, due_date:e.target.value})} />
          <select value={assignForm.class_id} onChange={e=>setAssignForm({...assignForm, class_id:e.target.value})}>
            <option value="">All Classes</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="file" onChange={e=>setFile(e.target.files[0])} />
          <button onClick={publish}>Publish</button>
        </div>
        <h4>ASSIGNMENTS {assignments.length}</h4>
        {assignments.map(a=><div key={a.id} style={{display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #eee"}}><span>{a.title}</span><a href={a.attachment_url} target="_blank" rel="noreferrer"><button>Download</button></a></div>)}
      </div>
      <div style={{background:"white", padding:12, borderRadius:8, gridColumn:"1 / span 2"}}>
        <h3>All Users ({users.length})</h3>
        <table width="100%" style={{fontSize:13}}><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Class</th><th>Active</th><th>Action</th></tr></thead>
        <tbody>{users.map(u=><tr key={u.id}><td>{u.email}</td><td>{u.full_name}</td><td>{u.role}</td><td>
          <select value={u.class_id||""} onChange={e=>assignClass(u.id, e.target.value)}>
            <option value="">No Class</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </td><td>{u.is_active?"Yes":"No"}</td><td><button onClick={()=>toggleActive(u)}>{u.is_active?"Deactivate":"Approve"}</button></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

function FacultyDash({user}){
  const [myClasses,setMyClasses]=useState([]);
  const [assignments,setAssignments]=useState([]);
  const [form,setForm]=useState({title:"", course:"", due_date:"", class_id:""});
  const [file,setFile]=useState(null);
  const [subs,setSubs]=useState([]);
  const [selectedAssign,setSelectedAssign]=useState(null);

  async function load(){
    const {data:cls}=await supabase.from("classes").select("*").eq("faculty_id", user.id);
    setMyClasses(cls||[]);
    if(cls && cls.length) setForm(f=>({...f, class_id: f.class_id||cls[0].id}));
    const {data:as}=await supabase.from("assignments").select("*").eq("created_by", user.id).order("created_at",{ascending:false});
    setAssignments(as||[]);
  }
  useEffect(()=>{load()},[]);

  async function publish(){
    let url=null;
    if(file){
      const path=`assignments/${Date.now()}_${file.name}`;
      await supabase.storage.from("mars-files").upload(path, file);
      url = supabase.storage.from("mars-files").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await supabase.from("assignments").insert({
      title:form.title, course:form.course, due_date:form.due_date||null,
      class_id:form.class_id, attachment_url:url, created_by:user.id
    });
    if(error) alert(error.message); else { alert("Published"); setForm({title:"",course:"",due_date:"",class_id:myClasses[0]?.id||""}); load(); }
  }

  async function viewSubs(assign){
    setSelectedAssign(assign);
    const {data, error}=await supabase.from("submissions").select("*, users!submissions_student_id_fkey(full_name,email,class_id)").eq("assignment_id", assign.id).order("submitted_at",{ascending:false});
    if(error) alert(error.message);
    setSubs(data||[]);
  }

  return (
    <div style={{padding:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
      <div style={{background:"white", padding:12, borderRadius:8}}>
        <h3>Publish Assignment - My Classes: {myClasses.map(c=>c.name).join(", ")}</h3>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          <input placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
          <input placeholder="Course" value={form.course} onChange={e=>setForm({...form, course:e.target.value})} />
          <input type="date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})} />
          <select value={form.class_id} onChange={e=>setForm({...form, class_id:e.target.value})}>
            {myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="file" onChange={e=>setFile(e.target.files[0])} />
          <button onClick={publish}>Publish</button>
        </div>
        <h4>My Assignments ({assignments.length})</h4>
        {assignments.map(a=><div key={a.id} style={{display:"flex", justifyContent:"space-between", borderBottom:"1px solid #eee", padding:"6px 0"}}>
          <span>{a.title} ({myClasses.find(c=>c.id===a.class_id)?.name})</span>
          <button onClick={()=>viewSubs(a)}>View Submissions</button>
        </div>)}
      </div>
      <div style={{background:"white", padding:12, borderRadius:8}}>
        <h3>{selectedAssign?`Submissions for ${selectedAssign.title} (${subs.length})`:"Select an assignment to view submissions"}</h3>
        {subs.map(s=>(
          <div key={s.id} style={{border:"1px solid #ddd", padding:8, marginBottom:8, borderRadius:6}}>
            <b>{s.users?.full_name} ({s.users?.email})</b><br/>
            <a href={s.file_url} target="_blank" rel="noreferrer">Download Answer</a> - {new Date(s.submitted_at).toLocaleString()}<br/>
            Status: {s.status} {s.grade!=null && <b> - Grade: {s.grade}/100</b>}<br/>
            <div style={{display:"flex", gap:4, marginTop:6}}>
              <input placeholder="Grade 0-100" type="number" defaultValue={s.grade||""} id={`g-${s.id}`} style={{width:100}} />
              <input placeholder="Feedback" defaultValue={s.feedback||""} id={`f-${s.id}`} style={{flex:1}} />
              <button onClick={async()=>{
                const grade=document.getElementById(`g-${s.id}`).value;
                const fb=document.getElementById(`f-${s.id}`).value;
                const {error}=await supabase.from("submissions").update({grade:parseInt(grade), feedback:fb, status:"graded"}).eq("id", s.id);
                if(error) alert(error.message); else { alert("Graded!"); viewSubs(selectedAssign); }
              }}>Save</button>
            </div>
          </div>
        ))}
        {selectedAssign && subs.length===0 && <p>No submissions yet.</p>}
      </div>
    </div>
  );
}

function StudentDash({user, profile, isParent}){
  const [faculty,setFaculty]=useState(null);
  const [assignments,setAssignments]=useState([]);
  const [mySubs,setMySubs]=useState({});
  const [uploading,setUploading]=useState(null);

  async function load(){
    if(profile.class_id){
      const {data:cls}=await supabase.from("classes").select("*, users!classes_faculty_id_fkey(full_name,email)").eq("id", profile.class_id).single();
      if(cls) setFaculty(cls.users);
    }
    let q=supabase.from("assignments").select("*").order("created_at",{ascending:false});
    if(profile.class_id) q=q.or(`class_id.eq.${profile.class_id},class_id.is.null`);
    const {data:as}=await q;
    setAssignments(as||[]);
    const {data:subs}=await supabase.from("submissions").select("*").eq("student_id", user.id);
    const map={}; subs?.forEach(s=>map[s.assignment_id]=s); setMySubs(map);
  }
  useEffect(()=>{load()},[]);

  async function submitWork(assign, file){
    if(!file) return;
    setUploading(assign.id);
    const path=`submissions/${assign.id}/${user.id}_${Date.now()}_${file.name}`;
    const {error: upErr}=await supabase.storage.from("mars-files").upload(path, file);
    if(upErr){ alert(upErr.message); setUploading(null); return; }
    const url = supabase.storage.from("mars-files").getPublicUrl(path).data.publicUrl;
    const {error}=await supabase.from("submissions").upsert({
      assignment_id: assign.id, student_id: user.id, file_url: url, status:"submitted", submitted_at: new Date().toISOString()
    }, {onConflict:"assignment_id,student_id"});
    setUploading(null);
    if(error) alert(error.message); else { alert("Submitted!"); load(); }
  }

  return (
    <div style={{padding:16, display:"grid", gridTemplateColumns:"250px 1fr", gap:16}}>
      <div style={{background:"white", padding:12, borderRadius:8, height:"fit-content"}}>
        <h4>MY CLASS</h4><p>{profile.class_id?"Assigned":"Not assigned"}</p>
        <h4>MY FACULTY</h4><p>{faculty? `${faculty.full_name} (${faculty.email})` : "No faculty assigned yet."}</p>
        {isParent && <p style={{color:"#666"}}>Parent view - read only</p>}
      </div>
      <div style={{background:"white", padding:12, borderRadius:8}}>
        <h3>ASSIGNMENTS {assignments.length}</h3>
        {assignments.map(a=>{
          const sub=mySubs[a.id];
          return (
            <div key={a.id} style={{border:"1px solid #ddd", padding:10, marginBottom:10, borderRadius:6}}>
              <div style={{display:"flex", justifyContent:"space-between"}}>
                <b>{a.title}</b><span>{a.course} {a.due_date?` - Due ${a.due_date}`:""}</span>
              </div>
              {a.attachment_url && <a href={a.attachment_url} target="_blank" rel="noreferrer"><button style={{marginTop:6}}>Download Question</button></a>}
              <div style={{marginTop:10, background:"#f9f9f9", padding:8, borderRadius:6}}>
                {sub? (
                  <>
                    <div>✅ Submitted: <a href={sub.file_url} target="_blank" rel="noreferrer">My Answer</a> on {new Date(sub.submitted_at).toLocaleString()}</div>
                    {sub.status==="graded"? <div style={{marginTop:6, color:"green"}}><b>Grade: {sub.grade}/100</b><br/>Feedback: {sub.feedback||"No feedback"}</div> : <div style={{color:"orange"}}>Status: Submitted - waiting for grading</div>}
                    {!isParent && <div style={{marginTop:6}}><input type="file" onChange={e=>submitWork(a, e.target.files[0])} /><small> Resubmit will replace</small></div>}
                  </>
                ) : (
                 !isParent? (
                    <div>{uploading===a.id? "Uploading..." : <><input type="file" onChange={e=>submitWork(a, e.target.files[0])} /><div style={{fontSize:12, marginTop:4}}>Upload PDF/Doc to submit</div></>}</div>
                  ) : <div>No submission yet</div>
                )}
              </div>
            </div>
          );
        })}
        {assignments.length===0 && <p>No assignments for your class yet.</p>}
      </div>
    </div>
  );
}