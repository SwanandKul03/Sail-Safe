// Shared footprints keep the sailing routes aligned with the visible islands
// and piers. Clearance covers the whole ship, including its bowsprit, as it turns.
export const PORTS = [
  {id:'research',x:-19,z:-8,r:6.2,rz:5.1,seed:2,trees:7,dock:{x:-11,z:-4},pier:{x:4.3,z:1.2,rotation:.1}},
  {id:'experience',x:17,z:-14,r:7.2,rz:5.8,seed:8,trees:4,dock:{x:8,z:-9},pier:{x:-4.8,z:2.4,rotation:Math.PI}},
  {id:'evaluation',x:10,z:17,r:5.5,rz:4.6,seed:13,trees:5,dock:{x:3,z:13},pier:{x:-4,z:.3,rotation:Math.PI}}
];

export function islandOutline(port) {
  return Array.from({length:13},(_,k)=>{
    const a=k/13*Math.PI*2,wobble=1+Math.sin(k*2.9+port.seed)*.1;
    return {x:Math.cos(a)*port.r*wobble,z:Math.sin(a)*port.rz*wobble};
  });
}

export function sceneObstacles() {
  return PORTS.flatMap(port=>{
    const p=port.pier,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    return [
      islandOutline(port).map(v=>({x:port.x+v.x,z:port.z+v.z})),
      [[-.25,-.825],[4.57,-.825],[4.57,.825],[-.25,.825]].map(([x,z])=>({
        x:port.x+p.x+c*x+s*z,z:port.z+p.z-s*x+c*z
      }))
    ];
  });
}

const distanceSq=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
function pointSegmentSq(p,a,b) {
  const length=distanceSq(a,b);
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.z-a.z)*(b.z-a.z))/length)):0;
  return (p.x-a.x-(b.x-a.x)*t)**2+(p.z-a.z-(b.z-a.z)*t)**2;
}
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function segmentDistanceSq(a,b,c,d) {
  if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&
     Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.max(c.x,d.x)>=Math.min(a.x,b.x)&&
     Math.max(a.z,b.z)>=Math.min(c.z,d.z)&&Math.max(c.z,d.z)>=Math.min(a.z,b.z))return 0;
  return Math.min(pointSegmentSq(a,c,d),pointSegmentSq(b,c,d),pointSegmentSq(c,a,b),pointSegmentSq(d,a,b));
}
function inside(p,polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)result=!result;
  }
  return result;
}

export function createWaterNavigation({obstacles=sceneObstacles(),clearance=5.4,bounds={minX:-32,maxX:33,minZ:-31,maxZ:30}}={}) {
  const radiusSq=clearance**2;
  const inBounds=p=>p.x>=bounds.minX&&p.x<=bounds.maxX&&p.z>=bounds.minZ&&p.z<=bounds.maxZ;
  function isWater(p) {
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!inBounds(p))return false;
    return !obstacles.some(poly=>inside(p,poly)||poly.some((a,i)=>pointSegmentSq(p,a,poly[(i+1)%poly.length])<radiusSq));
  }
  function segmentIsWater(a,b) {
    return isWater(a)&&isWater(b)&&!obstacles.some(poly=>poly.some((c,i)=>segmentDistanceSq(a,b,c,poly[(i+1)%poly.length])<radiusSq));
  }
  // Cache a small water-only graph. Adjacent nodes are also checked as swept
  // segments, preventing diagonal corner cuts and passage through narrow piers.
  const nodes=[],lookup=new Map();
  for(let x=bounds.minX;x<=bounds.maxX;x++)for(let z=bounds.minZ;z<=bounds.maxZ;z++) {
    const p={x,z};
    if(isWater(p)){lookup.set(`${x},${z}`,nodes.length);nodes.push({...p,neighbours:null});}
  }
  function nearestWater(p) {
    const point={x:Math.max(bounds.minX,Math.min(bounds.maxX,p.x)),z:Math.max(bounds.minZ,Math.min(bounds.maxZ,p.z))};
    if(isWater(point))return point;
    let best=null,distance=Infinity;
    for(const node of nodes){const d=distanceSq(point,node);if(d<distance){best=node;distance=d;}}
    return best?{x:best.x,z:best.z}:null;
  }
  function nearestNode(p) {
    const order=nodes.map((node,index)=>({index,d:distanceSq(p,node)})).sort((a,b)=>a.d-b.d);
    return order.find(n=>segmentIsWater(p,nodes[n.index]))?.index;
  }
  function neighbours(index) {
    const node=nodes[index];
    if(node.neighbours)return node.neighbours;
    node.neighbours=[];
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
      if(!dx&&!dz)continue;
      const next=lookup.get(`${node.x+dx},${node.z+dz}`);
      if(next!==undefined&&segmentIsWater(node,nodes[next]))node.neighbours.push({index:next,cost:Math.hypot(dx,dz)});
    }
    return node.neighbours;
  }
  function planRoute(from,requested) {
    const to=nearestWater(requested);
    if(!to||!isWater(from))return [];
    const start={x:from.x,z:from.z};
    if(segmentIsWater(start,to))return [start,to];
    const first=nearestNode(start),last=nearestNode(to);
    if(first===undefined||last===undefined)return [];
    const costs=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1);
    const open=new Set([first]),closed=new Set();costs[first]=0;
    while(open.size) {
      let current,score=Infinity;
      for(const n of open){const candidate=costs[n]+Math.sqrt(distanceSq(nodes[n],nodes[last]));if(candidate<score){score=candidate;current=n;}}
      if(current===last)break;
      open.delete(current);closed.add(current);
      for(const next of neighbours(current)) {
        if(closed.has(next.index))continue;
        const cost=costs[current]+next.cost;
        if(cost<costs[next.index]){costs[next.index]=cost;previous[next.index]=current;open.add(next.index);}
      }
    }
    if(!Number.isFinite(costs[last]))return [];
    const middle=[];
    for(let n=last;n!==-1;n=previous[n])middle.push({x:nodes[n].x,z:nodes[n].z});
    const raw=[start,...middle.reverse(),to],path=[start];
    for(let i=0;i<raw.length-1;) {
      let next=raw.length-1;
      while(next>i+1&&!segmentIsWater(raw[i],raw[next]))next--;
      path.push(raw[next]);i=next;
    }
    return path;
  }
  function move(from,delta) {
    const to={x:from.x+delta.x,z:from.z+delta.z};
    if(segmentIsWater(from,to))return to;
    let low=0,high=1;
    for(let i=0;i<20;i++) {
      const t=(low+high)/2,p={x:from.x+delta.x*t,z:from.z+delta.z*t};
      if(segmentIsWater(from,p))low=t;else high=t;
    }
    return {x:from.x+delta.x*low,z:from.z+delta.z*low};
  }
  return {isWater,segmentIsWater,nearestWater,planRoute,move};
}
