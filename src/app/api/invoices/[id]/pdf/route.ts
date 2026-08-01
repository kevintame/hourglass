import { asc, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { db } from "@/db";
import { invoiceLines, invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

type Business={businessName:string;ownerName:string;email:string;phone:string;address:string;paymentInstructions:string;logoPath?:string|null};
type Client={name:string;contactName:string;email:string;address:string};

function safe(value:unknown){return String(value??"").replace(/[^\x20-\x7E\n]/g,"");}
function wrap(text:string,max=76){const words=safe(text).split(/\s+/);const lines:string[]=[];let line="";for(const word of words){if((line+" "+word).trim().length>max){if(line)lines.push(line);line=word}else line=(line+" "+word).trim()}if(line)lines.push(line);return lines;}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  await requireUser(); const id=Number((await params).id);
  const [invoice]=await db.select().from(invoices).where(eq(invoices.id,id)).limit(1);
  if(!invoice)return new Response("Not found",{status:404});
  const lines=await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId,id)).orderBy(asc(invoiceLines.sortOrder));
  const business=invoice.businessSnapshot as Business; const client=invoice.clientSnapshot as Client;
  const pdf=await PDFDocument.create(); const regular=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const green=rgb(.075,.31,.23), ink=rgb(.09,.13,.11), gray=rgb(.4,.44,.42), rule=rgb(.86,.86,.82);
  let page=pdf.addPage([612,792]); let y=735;
  const draw=(value:string,x:number,size=10,font=regular,color=ink)=>page.drawText(safe(value),{x,y,size,font,color});
  const next=(n=16)=>{y-=n};
  if(business.logoPath){try{const logoBytes=await readFile(business.logoPath);const logo=business.logoPath.toLowerCase().endsWith(".png")?await pdf.embedPng(logoBytes):await pdf.embedJpg(logoBytes);const scale=Math.min(110/logo.width,45/logo.height,1);page.drawImage(logo,{x:48,y:724-logo.height*scale,width:logo.width*scale,height:logo.height*scale});y=680;}catch{}}
  draw(safe(business.businessName),48,23,bold,green); next(24); draw(safe(business.ownerName),48,9,regular,gray); next(13); draw(safe(business.email),48,9,regular,gray);
  page.drawText("INVOICE",{x:471,y:735,size:10,font:bold,color:green}); page.drawText(invoice.number,{x:420,y:708,size:18,font:bold,color:ink}); page.drawText(`Issued ${invoice.issueDate}`,{x:442,y:685,size:9,font:regular,color:gray}); page.drawText(`Due ${invoice.dueDate}`,{x:451,y:671,size:9,font:regular,color:gray});
  y=620; draw("BILL TO",48,8,bold,green); next(18); draw(client.name,48,14,bold); next(17); for(const part of [client.contactName,client.email,...safe(client.address).split("\n")].filter(Boolean)){draw(safe(part),48,9,regular,gray);next(13)}
  y=Math.min(y-24,535); page.drawLine({start:{x:48,y},end:{x:564,y},thickness:1,color:rule}); next(24); draw("DESCRIPTION",48,8,bold,gray); page.drawText("QTY",{x:355,y,size:8,font:bold,color:gray}); page.drawText("RATE",{x:420,y,size:8,font:bold,color:gray}); page.drawText("AMOUNT",{x:510,y,size:8,font:bold,color:gray}); next(17);
  for(const line of lines){const desc=wrap(line.description,50);const needed=Math.max(34,desc.length*12+13);if(y-needed<150){page=pdf.addPage([612,792]);y=735;page.drawText(`Invoice ${invoice.number} · continued`,{x:48,y,size:9,font:bold,color:green});y-=30}desc.forEach((part,i)=>page.drawText(part,{x:48,y:y-i*12,size:9,font:i===0?bold:regular,color:ink}));page.drawText(line.kind==="time"?`${(line.quantity/60).toFixed(2)} hr`:(line.quantity/100).toFixed(2),{x:355,y,size:9,font:regular,color:ink});page.drawText(formatMoney(line.unitAmount,invoice.currency),{x:420,y,size:9,font:regular,color:ink});page.drawText(formatMoney(line.amount,invoice.currency),{x:504,y,size:9,font:bold,color:ink});y-=needed;page.drawLine({start:{x:48,y:y+8},end:{x:564,y:y+8},thickness:.5,color:rule});}
  y-=7; page.drawText("Subtotal",{x:420,y,size:10,font:regular,color:gray}); page.drawText(formatMoney(invoice.subtotal,invoice.currency),{x:504,y,size:10,font:bold,color:ink}); y-=20;
  if(invoice.taxBps>0){page.drawText(`Tax ${(invoice.taxBps/100).toFixed(2)}%`,{x:420,y,size:10,font:regular,color:gray});page.drawText(formatMoney(invoice.taxAmount,invoice.currency),{x:504,y,size:10,font:bold,color:ink});y-=25}
  page.drawLine({start:{x:420,y:y+10},end:{x:564,y:y+10},thickness:1.5,color:ink}); page.drawText("Total",{x:420,y:y-7,size:14,font:bold,color:ink}); page.drawText(formatMoney(invoice.total,invoice.currency),{x:496,y:y-7,size:14,font:bold,color:green});
  y-=65; if(invoice.notes){page.drawText("NOTE",{x:48,y,size:8,font:bold,color:green});y-=16;for(const line of wrap(invoice.notes,90).slice(0,4)){page.drawText(line,{x:48,y,size:9,font:regular,color:gray});y-=12}}
  if(business.paymentInstructions&&y>80){y-=12;page.drawText("PAYMENT",{x:48,y,size:8,font:bold,color:green});y-=16;for(const line of wrap(business.paymentInstructions,90).slice(0,4)){page.drawText(line,{x:48,y,size:9,font:regular,color:gray});y-=12}}
  const bytes=await pdf.save();
  return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${invoice.number}.pdf"`,"Cache-Control":"private, no-store"}});
}
