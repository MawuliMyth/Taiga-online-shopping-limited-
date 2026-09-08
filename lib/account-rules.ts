export const emptyDeliveryAddress={first_name:"",last_name:"",phone:"",additional_phone:"",line1:"",additional_info:"",state:"",city:""};
export function readDeliveryAddress(value:unknown){
  const source=value&&typeof value==="object"?value as Record<string,unknown>:{};
  return Object.fromEntries(Object.keys(emptyDeliveryAddress).map(key=>[key,typeof source[key]==="string"?source[key]:""])) as typeof emptyDeliveryAddress;
}
export function validateDeliveryAddress(address:typeof emptyDeliveryAddress){
  const name=/^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/u;
  if(!name.test(address.first_name.trim())||!name.test(address.last_name.trim()))return "Enter a valid first and last name.";
  if(!/^(?:\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9]{8}$/.test(address.phone.replace(/[\s()-]/g,"")))return "Enter a valid Nigerian phone number.";
  if(address.line1.trim().length<5)return "Enter a complete street address.";
  if(!address.state||!address.city)return "Select your state and city.";
  return "";
}
