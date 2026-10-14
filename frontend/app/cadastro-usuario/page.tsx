"use client";

import { AuthPanel } from "../auth-panel";

export default function Page() { return <AuthPanel initialMode="request" onLogin={()=>window.location.replace("/")}/>; }
