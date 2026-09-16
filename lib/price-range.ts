export function priceRange(product:{price:number|string;variants?:any[]}){
  const prices=(product.variants??[]).filter(v=>v.active!==false).map(v=>Number(v.price??product.price)).filter(n=>Number.isFinite(n)&&n>=0);
  if(!prices.length)prices.push(Number(product.price));
  return {min:Math.min(...prices),max:Math.max(...prices)};
}
export function priceLabel(product:{price:number|string;variants?:any[]}){
  const {min,max}=priceRange(product);
  const money=(n:number)=>`₦${n.toLocaleString("en-NG")}`;
  return min===max?money(min):`${money(min)} – ${money(max)}`;
}
