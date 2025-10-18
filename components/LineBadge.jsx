const COLORS = {
  bakerloo: "bg-[#B36305]",
  central: "bg-[#E32017]",
  circle: "bg-[#FFD300] text-black",
  district: "bg-[#00782A]",
  elizabeth: "bg-[#6950A1]",
  hammersmithcity: "bg-[#F3A9BB] text-black",
  jubilee: "bg-[#A0A5A9] text-black",
  metropolitan: "bg-[#9B0056]",
  northern: "bg-[#000000]",
  piccadilly: "bg-[#003688]",
  victoria: "bg-[#0098D4]",
  waterlooandcity: "bg-[#95CDBA] text-black",
  dlr: "bg-[#00A4A7]",
  overground: "bg-[#EE7C0E]",
};
export default function LineBadge({ id, name, small }) {
  const key = String(id||"").replace(/[^a-z]/gi, "").toLowerCase();
  const klass = COLORS[key] || "bg-neutral-700";
  return (<span className={`badge ${klass} ${small?'text-[10px]':''}`}>{name || id}</span>);
}
