export function solve(t){
const R=t.split('\n').filter(r=>r.length),W=Math.max(...R.map(r=>r.length)),H=R.length,N=W*H;
const A=new Uint8Array(N),G=new Uint8Array(N),B=new Uint8Array(N);let s=-1;
R.forEach((r,y)=>{for(let x=0;x<r.length;x++){const c=r[x],i=y*W+x;if(c=='#')continue;A[i]=1;if('.*+'.includes(c))G[i]=1;if('$*'.includes(c))B[i]=1;if('@+'.includes(c))s=i}});
const X=i=>i%W,Y=i=>(i-i%W)/W,D=[[0,-1],[0,1],[-1,0],[1,0]];
const NB=i=>{const x=X(i),y=Y(i),o=[];if(y&&A[i-W])o.push([i-W,0]);if(y<H-1&&A[i+W])o.push([i+W,1]);if(x&&A[i-1])o.push([i-1,2]);if(x<W-1&&A[i+1])o.push([i+1,3]);return o};
const V=new Uint8Array(N),q=[];
for(let i=0;i<N;i++)if(G[i])V[i]=1,q.push(i);
while(q.length){const v=q.pop(),x=X(v),y=Y(v);
 for(const[dx,dy]of D){const sx=x-2*dx,sy=y-2*dy,fx=x-dx,fy=y-dy;
  if(sx<0||sy<0||sx>=W||sy>=H)continue;const g=fy*W+fx,st=sy*W+sx;
  if(!A[g]||!A[st]||V[g])continue;V[g]=1;q.push(g)}}
const hy=Y(s),RS=[];
for(const dy of[-1,1]){const ry=hy+dy;if(ry<0||ry>=H)continue;
 for(let x=0;x<W;x++){const d=ry*W+x;if(!A[d]||!A[hy*W+x])continue;
  const se=new Set([d]),cs=[d],st2=[d];
  while(st2.length){const v=st2.pop();for(const[j]of NB(v)){if(Y(j)==hy||se.has(j))continue;se.add(j);cs.push(j);st2.push(j)}}
  const bs=cs.filter(c=>B[c]);if(bs.length)RS.push({cs,bs,hall:hy*W+x})}}
const plan=R_=>{const{cs,bs,hall:h}=R_,U=new Uint8Array(N),C=new Uint8Array(N);
 for(const c of cs)U[c]=1,C[c]=1;U[h]=1;
 const reg=(f2,bx,o)=>{o.fill(0);if(!U[f2])return f2;o[f2]=1;const st=[f2];let mn=f2;
  while(st.length){const v=st.pop();if(v<mn)mn=v;for(const[j]of NB(v)){if(!U[j]||o[j]||bx[j])continue;o[j]=1;st.push(j)}}return mn};
 const m0=new Uint8Array(N);for(const b of bs)m0[b]=1;
 const R1=new Uint8Array(N),R2=new Uint8Array(N);
 const BT=[[...bs].sort((a,b)=>a-b)],BM=[m0],MN=[reg(h,m0,R1)],PA=[-1],PU=[null];
 const se=new Set([BT[0].join(',')+'|'+MN[0]]);
 for(let i=0;i<BT.length;i++){reg(MN[i],BM[i],R1);
  for(let k=0;k<BT[i].length;k++){const b=BT[i][k];
   for(const[dx,dy]of D){const d=dy*W+dx,p2=b-d,tb=b+d;
    if(!A[p2]||BM[i][p2]||!R1[p2])continue;
    if(!C[tb]||BM[i][tb]||!V[tb])continue;
    const nb=BT[i].slice();nb[k]=tb;nb.sort((a,b2)=>a-b2);
    const nm=BM[i].slice();nm[b]=0;nm[tb]=1;
    const mn=reg(b,nm,R2),key=nb.join(',')+'|'+mn;if(se.has(key))continue;se.add(key);
    BT.push(nb);BM.push(nm);MN.push(mn);PA.push(i);PU.push([b,tb,'udlr'[[0,1,2,3].find(z=>D[z][0]==dx&&D[z][1]==dy)]]);
    if(nb.every(c=>G[c])){const pl=[];for(let z=BT.length-1;z;z=PA[z])pl.push(PU[z]);pl.reverse();
     const bm=new Uint8Array(N);for(const b2 of bs)bm[b2]=1;let p3=h,out='';let bad=0;
     const walk=(a,z)=>{if(a==z)return '';const pv=new Int32Array(N).fill(-2),lt=new Array(N).fill('');pv[a]=-1;const q3=[a];
      for(let t2=0;t2<q3.length;t2++){const v=q3[t2];if(v==z)break;for(const[j,n2]of NB(v)){if(!U[j]||bm[j]||pv[j]!=-2)continue;pv[j]=v;lt[j]='udlr'[n2];q3.push(j)}}
      if(pv[z]==-2)return null;let s3='';for(let v=z;pv[v]!=-1;v=pv[v])s3=lt[v]+s3;return s3};
     for(const[b2,tb2,l]of pl){const d2=tb2-b2,r2=walk(p3,b2-d2);if(r2===null){bad=1;break}out+=r2+l;bm[b2]=0;bm[tb2]=1;p3=b2}
     if(!bad)return{m:out,p:p3,cs}}}}
  }
 return null};
const PT=RS.map(r=>({r,pl:plan(r)}));
for(const o of PT)if(!o.pl)return{moves:null};
const walkAll=(a,z,bm)=>{if(a==z)return '';if(!A[a]||!A[z])return null;const pv=new Int32Array(N).fill(-2),lt=new Array(N).fill('');pv[a]=-1;const q4=[a];
 for(let t3=0;t3<q4.length;t3++){const v=q4[t3];if(v==z)break;for(const[j,n3]of NB(v)){if(bm[j]||pv[j]!=-2)continue;pv[j]=v;lt[j]='udlr'[n3];q4.push(j)}}
 if(pv[z]==-2)return null;let s4='';for(let v=z;pv[v]!=-1;v=pv[v])s4=lt[v]+s4;return s4};
const play=(e,mv,bm)=>{let p6=e;for(const ch of mv){const n4='udlr'.indexOf(ch),d3=D[n4][1]*W+D[n4][0],nx=p6+d3;if(bm[nx]){bm[nx]=0;bm[nx+d3]=1}p6=nx}return p6};
const go=(left,p4,bm)=>{if(!left.length)return{moves:''};
 for(const o of left){const w2=walkAll(p4,o.r.hall,bm);if(w2===null)continue;
  const nb=bm.slice(),p5=play(o.r.hall,o.pl.m,nb);
  const sub=go(left.filter(z=>z!=o),p5,nb);
  if(sub)return{moves:w2+o.pl.m+sub.moves}}
 return null};
const res=go(PT,s,B.slice());
return{moves:res?res.moves:null}}
