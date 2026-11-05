const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
export async function assistantRequest(path,options={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),180000);
 try{
  const response=await fetch(BASE+path,{...options,signal:controller.signal});
  if(response.status===204)return null;
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:`Request rejected (${response.status}). Check the question or document limits.`);
  return data;
 }catch(error){
  if(error.name==='AbortError')throw new Error('The request timed out. Please try again.');
  if(error instanceof TypeError)throw new Error('Cannot reach the assistant backend. Start Poetry/Uvicorn on port 8000.');
  throw error;
 }finally{clearTimeout(timer);}
}
