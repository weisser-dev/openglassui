// Choose the nearest element in the requested direction using visible geometry.
// Aligned elements are preferred over distant diagonal candidates.
function spatialTarget(current, candidates, direction) {
 const center=rect=>({x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2});
 const origin=center(current);let best=-1,bestScore=Infinity;
 for(let i=0;i<candidates.length;i++){
  const rect=candidates[i];if(!rect || rect.width<=0 || rect.height<=0)continue;
  const target=center(rect),dx=target.x-origin.x,dy=target.y-origin.y;
  const primary=direction==='ArrowDown'?dy:direction==='ArrowUp'?-dy:direction==='ArrowRight'?dx:-dx;
  if(primary<=1)continue;
  const vertical=direction==='ArrowDown'||direction==='ArrowUp';
  const cross=Math.abs(vertical?dx:dy);
  const overlaps=vertical?rect.left<current.right&&rect.right>current.left:rect.top<current.bottom&&rect.bottom>current.top;
  const score=primary+cross*(overlaps?0.15:1.5)+(overlaps?0:40);
  if(score<bestScore){best=i;bestScore=score;}
 }
 return best;
}
