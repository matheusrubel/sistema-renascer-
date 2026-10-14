"use client";

import { useEffect, useState } from "react";
import { obterSessao } from "../../src/supabase";
import { AuthPanel } from "../auth-panel";

export default function Page() { const [ready,setReady]=useState(false); useEffect(()=>{setReady(true);},[]); if(ready&&obterSessao()?.access_token) window.location.replace("/"); return <AuthPanel onLogin={()=>window.location.replace("/")}/>; }
