import type { Data, Payment, Plan, User, College, AuditEntry, Post } from "./types";

import { BOTS } from "./bots";
export { BOTS };

export function rnd(seed: number) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function samplePayments(): Payment[] {
  return [
    {id:"pay1",userId:"u2",amount:"7.99",cur:"USD",plan:"Pro monthly",method:"Card",ref:"pi_3Q8xL2Ez91",error:"3-D Secure not completed, bank debited the card",date:"2026-10-11T09:20",status:"failed"},
    {id:"pay2",userId:"u9",amount:"59.00",cur:"USD",plan:"Pro annual",method:"PayPal",ref:"PAYID-MX4K2",error:"Webhook timed out, payment captured at provider",date:"2026-10-11T14:05",status:"failed"},
    {id:"pay3",userId:"u4",amount:"7.99",cur:"USD",plan:"Pro monthly",method:"Card",ref:"pi_3Q7aB0Ez55",error:"Verification mismatch, card verified later by provider",date:"2026-10-09T18:40",status:"rejected",note:"Duplicate of a successful payment"},
    {id:"pay4",userId:"u6",amount:"7.99",cur:"USD",plan:"Pro monthly",method:"Card",ref:"pi_3Q6vC9Ez12",error:"Gateway outage during checkout",date:"2026-10-08T07:10",status:"resolved",grantId:"g0"}
  ];
}

function sampleUsers(): User[] {

      var F=['Aarav','Sofia','Lucas','Priya','Emma','Mateo','Chloé','Rahul','Olivia','Diego','Ananya','Noah','Lena','Kabir','Isha','Liam','Mia','Arjun','Zoe','Ethan','Sara','Vihaan','Hannah','Leo','Nora','Aditya','Ava','Jonas','Meera','Oscar','Riya','Felix','Tara','Samuel','Anika','Daniel','Elif','Karan','Lucía','Max','Neha','Jack','Saanvi','Tom','Inès','Yash','Grace','Omar'];
      var L=['Mehta','Rossi','Martin','Nair','Johnson','García','Dubois','Verma','Brown','Fernández','Rao','Wilson','Müller','Singh','Kapoor','Smith','Jensen','Sharma','Taylor','Clark','López','Gupta','Becker','Moreau','Hill','Joshi','Evans','Weber','Iyer','Hughes','Bose','Fischer','Reddy','Lee','Shah','Kim','Yılmaz','Malhotra','Ruiz','Schmidt','Pillai','King','Desai','Wright','Bernard','Chopra','Scott','Haddad'];
      var CD:Record<string,string>={c1:'stu.upes.ac.in',c2:'mail.utoronto.ca',c3:'tum.de',c4:'student.uva.nl',c5:'ad.unsw.edu.au'},CC:Record<string,string>={c1:'India',c2:'Canada',c3:'Germany',c4:'Netherlands',c5:'Australia'};
      var CN=['United States','United States','United Kingdom','France','Spain','Canada','Australia','Germany','Mexico','Brazil','New Zealand','Italy'],LG:Record<string,string>={France:'fr',Spain:'es',Mexico:'es'};
      var SRC=['google','instagram','instagram','tiktok','reddit','referral','direct','youtube'],SUB=['math','math','physics','chemistry','biology','coding','finance'],r=rnd(7),now=Date.now();
      var pick=function<T>(a:T[]):T{return a[Math.floor(r()*a.length)]};
      return F.map(function(fn,i):User{
        var x=r(),col=x<.3?'c1':x<.4?'c2':x<.47?'c3':x<.52?'c4':x<.55?'c5':'';
        var p=r(),plan:Plan=p<.55?'Free':p<.67?'Pro trial':p<.9?'Pro monthly':'Pro annual';
        var country=col?CC[col]:pick(CN),lang=country==='India'&&r()<.3?'hi':(LG[country]||'en');
        var jd=Math.floor(r()*24),verified=r()<.9||!!col;
        var sc=col&&col!=='c5'&&verified?({c1:10,c2:5,c3:5,c4:5} as Record<string,number>)[col]:(col==='c5'?5:0);
        var vids=plan==='Free'?Math.floor(r()*3):Math.floor(3+r()*24),used=Math.min(vids,sc+Math.floor(r()*4));
        var la=Math.floor(r()*r()*30);
        return {id:'u'+i,name:fn+' '+L[i],email:(fn+'.'+L[i]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z.]+/g,'')+'@'+(col?CD[col]:pick(['gmail.com','gmail.com','outlook.com','icloud.com','yahoo.com'])),
          plan:plan,credits:Math.max(0,sc+(plan==='Free'?0:Math.floor(r()*30))-used+(plan==='Free'?Math.floor(r()*2):0)),joined:new Date(now-jd*864e5).toISOString().slice(0,10),status:(i===7?'suspended':'active') as User['status'],lang:lang,
          collegeId:col,country:country,source:col&&r()<.6?'college code':pick(SRC),device:(function(){var d=r();return d<.62?'mobile':d<.92?'desktop':'tablet'})(),subject:pick(SUB),
          videos:vids,chats:Math.floor(4+r()*90),signupCredits:sc,creditsUsed:used,pendingCredits:0,verified:verified,lastActive:new Date(now-Math.min(la,jd)*864e5-Math.floor(r()*20)*36e5).toISOString()};
      });
    }

function sampleColleges(): College[] {
  return [
      {id:'c1',name:'UPES Dehradun',domain:'upes.ac.in',country:'India',subdomains:true,credits:10,expiryDays:30,cap:500,code:'DUPES10',codeMode:'domain',requireVerify:true,starts:'',ends:'',active:true,note:'Campus launch with the student council.',created:'2026-10-01T10:00'},
      {id:'c2',name:'University of Toronto',domain:'utoronto.ca',country:'Canada',subdomains:true,credits:5,expiryDays:30,cap:200,code:'UOFT5',codeMode:'domain',requireVerify:true,starts:'',ends:'',active:true,note:'Friend runs the maths society.',created:'2026-10-04T10:00'},
      {id:'c3',name:'TU Munich',domain:'tum.de',country:'Germany',subdomains:true,credits:5,expiryDays:30,cap:0,code:'TUM5',codeMode:'code',requireVerify:true,starts:'',ends:'',active:true,note:'',created:'2026-10-06T10:00'},
      {id:'c4',name:'University of Amsterdam',domain:'uva.nl',country:'Netherlands',subdomains:true,credits:5,expiryDays:14,cap:50,code:'',codeMode:'domain',requireVerify:true,starts:'',ends:'',active:true,note:'Small pilot.',created:'2026-10-08T10:00'},
      {id:'c5',name:'UNSW Sydney',domain:'unsw.edu.au',country:'Australia',subdomains:true,credits:5,expiryDays:30,cap:100,code:'UNSW5',codeMode:'domain',requireVerify:true,starts:'',ends:'',active:false,note:'Paused until term starts.',created:'2026-10-02T10:00'},
      {id:'c6',name:'University of Delhi',domain:'du.ac.in',country:'India',subdomains:true,credits:3,expiryDays:30,cap:300,code:'DU3',codeMode:'domain',requireVerify:true,starts:'',ends:'',active:false,note:'Waiting for India launch.',created:'2026-10-10T10:00'}
    ];
}

function sampleAudit(): AuditEntry[] {
  return [
      {id:'a3',t:'2026-10-10T10:00',by:'admin',type:'college',action:'Added college',target:'du.ac.in',detail:'University of Delhi, 3 credits, paused'},
      {id:'a2',t:'2026-10-06T10:00',by:'admin',type:'college',action:'Added college',target:'tum.de',detail:'TU Munich, 5 credits'},
      {id:'a1',t:'2026-10-01T10:00',by:'admin',type:'college',action:'Added college',target:'upes.ac.in',detail:'UPES Dehradun, 10 credits'}
    ];
}

function samplePosts(): Post[] {
const body1 ="Boat and stream problems look hard because the same boat has two different speeds. They become easy once you see one idea: **the stream helps you in one direction and hurts you in the other**.\n\n## The two speeds you must know\n\nLet the boat's speed in still water be **v** and the stream's speed be **c** (both in km/h).\n\n- Downstream speed **D = v + c** (the stream pushes you)\n- Upstream speed **U = v - c** (the stream pushes back)\n\nTime is always distance divided by speed. That is all the physics you need.\n\n## Worked example\n\nA boat covers 42 km upstream and 81 km downstream in 8 hours. It covers 48 km upstream and 54 km downstream in 7 hours. How long does it take to cover 90 km in still water?\n\n### Step 1: write the equations\n\n42/U + 81/D = 8 and 48/U + 54/D = 7.\n\n### Step 2: turn fractions into a linear system\n\nLet x = 1/U and y = 1/D. Then 42x + 81y = 8 and 48x + 54y = 7.\n\n### Step 3: eliminate x\n\nMultiply the first by 48 and the second by 42. Subtract to get 1620y = 90, so y = 1/18 and **D = 18 km/h**. Substitute back to get x = 1/12, so **U = 12 km/h**.\n\n### Step 4: check\n\n42/12 + 81/18 = 3.5 + 4.5 = 8. And 48/12 + 54/18 = 4 + 3 = 7. Both hold.\n\n### Step 5: still-water speed\n\nAdding U and D cancels the stream: v = (U + D) / 2 = (12 + 18) / 2 = **15 km/h**. So 90 km takes 90 / 15 = **6 hours**.\n\n## Common mistakes\n\n- Using U = 6 and D = 18. It fails the first equation, because 42/6 + 81/18 = 11.5, not 8.\n- Forgetting to check by substitution.\n- Mixing up which speed is upstream.\n\n## Practice\n\nTry another one on the [Doubtster solver](/ask) and see the full step-by-step video explanation. For more on setting up equations, read [how to solve linear equations](/blog/solve-linear-equations).\n\n![Boat and stream diagram showing upstream and downstream speeds](/img/boat-stream.png)";
  return [
      {id:'p1',title:'How to Solve Boat and Stream Problems (With a Worked Example)',slug:'how-to-solve-boat-and-stream-problems',status:'published',date:'2026-10-05T09:00',updated:'2026-10-11T10:00',
       author:'Doubtster Team',category:'Maths',tags:['time and distance','boats and streams','aptitude'],lang:'en',
       tldr:'In boat and stream problems, downstream speed is the boat speed plus the stream speed, and upstream speed is the boat speed minus the stream speed. Write the two time equations, solve for both speeds, then average them to get the still-water speed.',
       cover:'https://doubtster.com/img/boat-stream-cover.png',coverAlt:'Diagram of a boat moving upstream and downstream',body:body1,
       focusKw:'boat and stream problems',secondaryKw:['upstream and downstream speed','time and distance'],metaTitle:'Boat and Stream Problems: Easy Method With Worked Example',
       metaDesc:'Learn boat and stream problems step by step. Understand upstream and downstream speed, solve a full worked example and avoid the common mistakes.',canonical:'',
       robots:{index:true,follow:true,img:true},ogTitle:'',ogDesc:'',ogImage:'',twitterCard:'summary_large_image',
       schema:{type:'BlogPosting',faq:true,breadcrumb:true},
       faqs:[{q:'What is the formula for downstream speed?',a:'Downstream speed equals the speed of the boat in still water plus the speed of the stream.'},
             {q:'How do you find the speed of a boat in still water?',a:'Add the upstream and downstream speeds and divide by 2.'},
             {q:'Why is upstream speed lower?',a:'The stream flows against the boat, so it reduces the boat\'s effective speed by the stream speed.'}],
       sources:[{title:'NCERT Mathematics, linear equations in two variables',url:'https://ncert.nic.in/textbook.php'}],hreflang:[]},
      {id:'p2',title:'Solve 3x - 7 = 11 Step by Step',slug:'solve-3x-minus-7-equals-11',status:'draft',date:'',updated:'2026-10-10T18:00',
       author:'Doubtster Team',category:'Maths',tags:['linear equations'],lang:'en',tldr:'Add 7 to both sides to get 3x = 18, then divide both sides by 3 to get x = 6. Check by substituting: 3(6) - 7 = 11.',
       cover:'',coverAlt:'',body:"## The idea\n\nAn equation is a balance. Whatever you do to one side, do to the other.\n\n## Steps\n\n1. Add 7 to both sides: 3x = 18.\n2. Divide both sides by 3: x = 6.\n3. Check: 3(6) - 7 = 11.",
       focusKw:'solve 3x - 7 = 11',secondaryKw:[],metaTitle:'',metaDesc:'',canonical:'',robots:{index:true,follow:true,img:true},ogTitle:'',ogDesc:'',ogImage:'',twitterCard:'summary_large_image',
       schema:{type:'BlogPosting',faq:false,breadcrumb:true},faqs:[],sources:[],hreflang:[]},
      {id:'p3',title:'Photosynthesis Explained: Light Reactions and the Calvin Cycle',slug:'photosynthesis-explained',status:'scheduled',date:'2026-10-20T09:00',updated:'2026-10-09T12:00',
       author:'Doubtster Team',category:'Biology',tags:['photosynthesis','plants'],lang:'en',tldr:'Photosynthesis turns light, carbon dioxide and water into glucose and oxygen inside chloroplasts. The light reactions make energy carriers and release oxygen from water. The Calvin cycle uses them to build glucose.',
       cover:'',coverAlt:'',body:"## What is photosynthesis?\n\nPlants make their own food using sunlight.\n\n## Two stages\n\n### Light reactions\n\nLight splits water and releases oxygen.\n\n### Calvin cycle\n\nCarbon dioxide is fixed into glucose.",
       focusKw:'photosynthesis',secondaryKw:['light reactions','calvin cycle'],metaTitle:'Photosynthesis Explained Simply',metaDesc:'',canonical:'',robots:{index:true,follow:true,img:true},ogTitle:'',ogDesc:'',ogImage:'',twitterCard:'summary_large_image',
       schema:{type:'BlogPosting',faq:false,breadcrumb:true},faqs:[],sources:[],hreflang:[]}
    ];
}

export function seed(): Data {
  const users = sampleUsers();
  return {
    v: 2,
    site: {name:"Doubtster",url:"https://doubtster.com",logo:"https://doubtster.com/brand/doubtster-icon.png",ogImage:"https://doubtster.com/opengraph-image.jpg",lang:"en",
      author:"Doubtster Team",authorUrl:"https://doubtster.com/about",authorBio:"The Doubtster team builds step-by-step explanations for students in maths, science, finance and more.",
      twitter:"@doubtster",sameAs:"https://x.com/doubtster\nhttps://www.youtube.com/@doubtster\nhttps://www.instagram.com/doubtster",gsc:"",bing:"",ga:"",indexnow:""},
    seo: { bots: Object.fromEntries(BOTS.map((b) => [b[0], b[2]])), redirects: [{ from: "/blog/old-boat-post", to: "/blog/how-to-solve-boat-and-stream-problems" }] },
    flags: {chat:true,video:true,notes:true,flashcards:true,quizzes:true,signups:true,maintenance:false,maintenanceMsg:"Doubtster is getting an upgrade. Back in a few minutes.",
      banner:false,bannerMsg:"New: French, Spanish and Hindi explanations are live.",trial:true,trialDays:7,creditsPerVideo:1,freeCredits:0,maxVideoMin:10,rateLimit:60,
      langs:{en:true,fr:true,es:true,hi:true},provider:"gemini",provider2:"groq",verify:true,
      priceTrial:1.99,trialVideos:3,priceMonthly:7.99,monthlyCredits:30,priceAnnual:59,topup10:4.99,topup25:9.99,costPerVideoMin:0.004,
      domains:{math:true,physics:true,chemistry:true,biology:true,coding:true,finance:true,law:true,history:true},
      bannerType:"info",bannerLink:"",bannerAudience:"all",bannerStarts:"",bannerEnds:"",
      ai:{chatProvider:"gemini",videoProvider:"gemini",notesProvider:"groq",fallback:true,temperature:0.3,maxTokens:2048,monthlyBudget:50,alertAt:80,overBudget:"pause_free"},
      chatx:{graphs:true,stepMode:true,followUps:true,share:true,maxQuestionChars:2000,historyDays:90},
      attachments:{images:true,pdf:true,docs:true,maxMB:10,maxFiles:3,ocr:true},
      videox:{defaultSec:120,maxPerDayFree:0,maxPerDayPaid:10,concurrent:2,resolution:"1080p",watermarkTrial:true,music:true,paidPriority:true,captions:true},
      creditsx:{rollover:false,topups:true,referral:true,referrerCredits:3,refereeCredits:2,lowCreditAlert:3},
      regions:{eu:true,uk:true,na:true,latam:true,anz:true,india:false,row:false},
      safety:{integrityMode:true,moderation:"standard",blockedWords:[],minAge:13,requireVerifyForChat:false},
      notify:{welcome:true,trialEnding:true,trialEndingDays:2,lowCredits:true,weeklyDigest:false,winBack:true},
      emergency:{stopVideo:false,stopCheckout:false,readOnly:false,stopSignupCredits:false},
      rollout:{voiceInput:0,aiTutorMode:0,newEditor:0,examMode:0}},
    posts: samplePosts(),
    users,
    colleges: sampleColleges(),
    creditGrants: users.filter((u) => u.signupCredits > 0).map((u) => ({ id: "cg_" + u.id, userId: u.id, emailHash: "", source: "college_signup" as const, collegeId: u.collegeId, credits: u.signupCredits, status: "granted" as const, expiresAt: "", createdAt: u.joined })),
    audit: sampleAudit(),
    payments: samplePayments(),
    grants: [{id:"g0",date:"2026-10-08T08:00",userId:"u6",plan:"Pro monthly",prevPlan:"Free",prevExpires:"",days:30,credits:5,reason:"Payment verification failed",note:"",ref:"pi_3Q6vC9Ez12",paymentId:"pay4",by:"admin",status:"active",expires:"2026-11-07"}],
    jobs: [
      {id:"j1",q:"Boat and stream, 90 km still water",lang:"en",domain:"math",target:180,actual:182,status:"done",verify:"verified"},
      {id:"j2",q:"Plan incliné et frottement",lang:"fr",domain:"physics",target:120,actual:118,status:"done",verify:"verified"},
      {id:"j3",q:"Rendimiento de la esterificación",lang:"es",domain:"chemistry",target:100,actual:0,status:"rendering",verify:"pending"},
      {id:"j4",q:"सामान्य बंटन समझाइए",lang:"hi",domain:"math",target:100,actual:97,status:"done",verify:"needs review"},
      {id:"j5",q:"Depreciation, straight line vs reducing balance",lang:"en",domain:"finance",target:300,actual:0,status:"queued",verify:"pending"},
      {id:"j6",q:"Binary search in Python",lang:"en",domain:"coding",target:240,actual:0,status:"failed",verify:"failed"},
      {id:"j7",q:"Photosynthesis light reactions",lang:"en",domain:"biology",target:150,actual:151,status:"done",verify:"verified"},
      {id:"j8",q:"Contract formation, IRAC",lang:"en",domain:"law",target:200,actual:0,status:"rendering",verify:"pending"}
    ],
    admins: [
      {
        id: "ad_main_head",
        email: "contact@doubtster.com",
        name: "Utkarsh",
        role: "super",
        perms: {
          overview: "edit",
          analytics: "edit",
          colleges: "edit",
          users: "edit",
          payments: "edit",
          videos: "edit",
          controls: "edit",
          blog: "edit",
          seo: "edit",
          audit: "edit",
          settings: "edit",
        },
        passHash: "scrypt$16384$8$1$SMEsD4KFiSLXlMZLxC42Jw==$izzw6X/bbxmYIdj9lyivyJKP3qbWcNHTvSJspN9Whqs=",
        status: "active",
        totpSecret: "",
        totpPending: "",
        recoveryHashes: [],
        failed: 0,
        lockedUntil: "",
        createdAt: "2026-10-25T22:05:36.384Z",
        createdBy: "setup",
        lastLogin: "",
        lastIp: "",
        userId: "",
      },
    ],
    sessions: [],
    invites: [],
    security: { require2fa: false, sessionHours: 8, idleMinutes: 60, maxFailed: 5, lockMinutes: 15, ipAllowlist: [], inviteHours: 48 },
    promos: [
      { id: "pr1", code: "WELCOME2", kind: "credits", value: 2, plans: [], maxUses: 0, perUser: 1, uses: 41, starts: "", ends: "", active: true, newUsersOnly: true, note: "Instagram bio code", createdAt: "2026-10-01T10:00", redemptions: [] },
      { id: "pr2", code: "EXAM20", kind: "percent", value: 20, plans: ["Pro monthly", "Pro annual"], maxUses: 200, perUser: 1, uses: 57, starts: "2026-10-15", ends: "2026-11-30", active: true, newUsersOnly: false, note: "Exam season", createdAt: "2026-10-14T10:00", redemptions: [] },
      { id: "pr3", code: "FRIENDS14", kind: "trial_days", value: 14, plans: [], maxUses: 50, perUser: 1, uses: 50, starts: "", ends: "", active: false, newUsersOnly: true, note: "Used up", createdAt: "2026-09-20T10:00", redemptions: [] },
    ],
    configHistory: [],
  };
}
