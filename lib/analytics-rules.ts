const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function analyticsEvent(input:Record<string,unknown>){
  if(![input.id,input.visitor_id,input.session_id].every(value=>typeof value==="string"&&uuid.test(value)))throw new Error("Invalid event");
  const path=String(input.path||"");
  if(!/^\/(?:$|shop$|search$|product\/[a-zA-Z0-9%_-]{1,220}$|help\/[a-z-]{1,60}$)/.test(path))throw new Error("Unsupported page");
  const source=String(input.source||"Direct").slice(0,120);
  if(!/^(?:Direct|[a-zA-Z0-9.-]+)$/.test(source))throw new Error("Invalid source");
  if(!["mobile","tablet","desktop"].includes(String(input.device)))throw new Error("Invalid device");
  return {id:input.id,visitor_id:input.visitor_id,session_id:input.session_id,path,source,device:input.device};
}
