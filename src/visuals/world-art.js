// Original, deterministic SVG stage art. Shared by interactive scenery,
// exported posters and storyboard clips. No remote images are required.
const themes = {
  'underworld-heir': ['#b4efcb', '#1b615d', '#051c24', '#79b8c1'],
  'myth-keeper': ['#ffdb98', '#9e7540', '#0c2330', '#52b4be'],
  'ghost-player': ['#ffa996', '#862f40', '#151b2d', '#7294b3'],
  'plot-rewriter': ['#cbb9ff', '#705dab', '#151b36', '#57c9d3'],
  'hidden-player': ['#8ddfff', '#357aa7', '#081c31', '#4ae2d1'],
  'reborn-queen': ['#ffb5a3', '#944455', '#251827', '#eab971'],
  'mind-reader': ['#ffcae1', '#9c6181', '#221c3a', '#b4bffa'],
  'chaos-director': ['#f1e898', '#6c678f', '#162c3c', '#c6b4ff'],
  'spirit-child': ['#b7f2d2', '#3d8272', '#102b30', '#e4d7a2'],
  'royal-chef': ['#ffd5a2', '#af774e', '#30232b', '#93b5a1'],
};

export const worldNotes = {
  'underworld-heir': { label: '祖谱开挂', power: '亲缘庇护', chapter: '鬼门关外，一声爷爷改写规则。', atmosphere: '冥灯 / 玄门 / 祖传底牌' },
  'myth-keeper': { label: '一念唤神', power: '失落记忆', chapter: '诸神沉寂，而你记得他们的名字。', atmosphere: '神域 / 天光 / 失落神话' },
  'ghost-player': { label: '恐怖免疫', power: '规则之外', chapter: '全员都在逃生，你却遇见了熟人。', atmosphere: '回廊 / 赤月 / 无解副本' },
  'plot-rewriter': { label: '改写命运', power: '剧情先知', chapter: '翻开第三章，把既定结局划掉。', atmosphere: '残卷 / 星轨 / 命运分岔' },
  'hidden-player': { label: '满级觉醒', power: '隐藏系统', chapter: '在被低估的世界，悄悄点满技能树。', atmosphere: '数据 / 裂隙 / 终极权限' },
  'reborn-queen': { label: '重启棋局', power: '重生布局', chapter: '这一世，轮到你先落子。', atmosphere: '宫阙 / 赤金 / 凤凰归来' },
  'mind-reader': { label: '心声外放', power: '全员读心', chapter: '你没说出口的真相，满朝都听见了。', atmosphere: '流光 / 宫灯 / 秘密回响' },
  'chaos-director': { label: '逻辑下线', power: '反套路脑洞', chapter: '请系好安全带，本集不负责合理。', atmosphere: '逆重力 / 浮岛 / 万物错位' },
  'spirit-child': { label: '天生仙骨', power: '神兽相伴', chapter: '小小身影，也能让整个宗门俯首。', atmosphere: '云海 / 青山 / 灵兽苏醒' },
  'royal-chef': { label: '离谱开席', power: '创意炼成', chapter: '太后要的那场雪，正从你的锅里升起。', atmosphere: '烟火 / 宫宴 / 灵感入味' },
};

Object.assign(worldNotes, {
  "villain-calmer": {
    "label": "先劝BOSS喝口水",
    "power": "火气自动降温",
    "chapter": "别人和反派拼命，你先劝他喝口水。",
    "atmosphere": "反派安抚流 / 第二季 / 主角登场"
  },
  "immortal-support": {
    "label": "飞剑异响请重启",
    "power": "故障一眼定位",
    "chapter": "飞剑报错别着急，售后比掌门靠谱。",
    "atmosphere": "修仙售后流 / 第二季 / 主角登场"
  },
  "apocalypse-caterer": {
    "label": "世界重启饭别凉",
    "power": "后勤永不断线",
    "chapter": "世界可以重启，这顿饭必须趁热。",
    "atmosphere": "末日后勤流 / 第二季 / 主角登场"
  },
  "lucky-disaster": {
    "label": "失误也能开宝箱",
    "power": "意外自动转运",
    "chapter": "你只是失误了一下，世界替你开了挂。",
    "atmosphere": "锦鲤翻盘流 / 第二季 / 主角登场"
  },
  "contract-judge": {
    "label": "拔刀之前先结账",
    "power": "边界写得很清楚",
    "chapter": "你负责拔刀，我负责算违约金。",
    "atmosphere": "江湖契约流 / 第二季 / 主角登场"
  },
  "social-shield": {
    "label": "祝福到了人先不去",
    "power": "个人空间守护者",
    "chapter": "别人靠社交破圈，你靠结界省电。",
    "atmosphere": "独处结界流 / 第二季 / 主角登场"
  },
  "dragon-office-worker": {
    "label": "翻江倒海也要下班",
    "power": "神级能力平常用",
    "chapter": "翻江倒海算特长，准点下班是理想。",
    "atmosphere": "龙王职场流 / 第二季 / 主角登场"
  },
  "spotlight-extra": {
    "label": "只是路过就成主角",
    "power": "镜头自动追焦",
    "chapter": "你只是想借过，镜头却认定了主角。",
    "atmosphere": "片场误认流 / 第二季 / 主角登场"
  },
  "heaven-admin": {
    "label": "天劫报错先回滚",
    "power": "规则读得比天道熟",
    "chapter": "别人研究天意，你直接打开后台。",
    "atmosphere": "隐藏·天道后台 / 第二季 / 主角登场"
  },
  "cosmic-director": {
    "label": "命运不对就重拍",
    "power": "一句开机世界入戏",
    "chapter": "别人忙着改命，你喊一声：这条重拍。",
    "atmosphere": "隐藏·宇宙片场 / 第二季 / 主角登场"
  }
});

export function worldSvg(role, uniqueId = role.id) {
  const baseTheme = themes[role.id] ?? themes[role.worldBase] ?? themes['chaos-director'];
  const [light, mid, dark, secondary] = themes[role.id] ?? [role.color, baseTheme[1], baseTheme[2], baseTheme[3]];
  const key = `world-${String(uniqueId).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const url = name => `url(#${key}-${name})`;
  const sceneNumber = Number(role.number);
  const stars = Array.from({ length: 75 }, (_, i) => {
    const x = (i * 137.508 + sceneNumber * 13) % 600;
    const y = (i * 91.357 + 23) % 720;
    const r = i % 9 === 0 ? 1.7 : .65;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${i % 4 === 0 ? secondary : light}" opacity="${.2 + (i % 5) * .12}"/>`;
  }).join('');

  const roof = (x, y, width, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M${-width / 2} 0 Q${-width / 2 + 32} 8 ${-width / 2 + 57} -8 L-20 -46 L0 -63 L20 -46 L${width / 2 - 57} -8 Q${width / 2 - 32} 8 ${width / 2} 0 L${width / 2 - 19} 17 L${-width / 2 + 19} 17Z" fill="${dark}" stroke="${light}" stroke-opacity=".5" stroke-width="2"/><path d="M${-width / 2 + 24} 10H${width / 2 - 24}" stroke="${light}" stroke-opacity=".8"/><path d="M${-width / 2 + 50} 17V108H${width / 2 - 50}V17" fill="${dark}" stroke="${mid}" stroke-width="3"/><path d="M-45 20V104M0 20V104M45 20V104" stroke="${light}" stroke-opacity=".18"/></g>`;
  const lantern = (x, y, size = 1) => `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0 -125V-37" stroke="${light}" stroke-opacity=".32"/><ellipse cy="3" rx="44" ry="57" fill="${url('lantern')}"/><path d="M-14 -26Q-25 0 -14 28H14Q25 0 14 -26Z" fill="${mid}" stroke="${light}" stroke-width="1.5"/><path d="M-8 -25Q-16 0 -8 28M8 -25Q16 0 8 28M0 -26V29" fill="none" stroke="${light}" stroke-opacity=".6"/><path d="M-17 -29H17M-17 31H17M0 31V61" stroke="${light}" stroke-width="3"/></g>`;
  const person = ({ x = 300, y = 697, scale = 1, female = false, crown = false, child = false, chef = false } = {}) => `<g transform="translate(${x} ${y}) scale(${scale})" class="world-character">
    <ellipse cy="102" rx="83" ry="12" fill="#020910" opacity=".65"/>
    <path d="M-21 -77Q-46 -69 -48 -27L-76 83Q-30 109 3 102Q46 110 77 84L47 -29Q44 -62 20 -78Z" fill="${url('robe')}" stroke="${light}" stroke-opacity=".48" stroke-width="1.5"/>
    <path d="M-20 -73L0 -13L19 -74L33 -21L14 83L0 98L-16 79L-31 -21Z" fill="${dark}" stroke="${light}" stroke-opacity=".28"/>
    <path d="M-44 -34Q-70 -23 -91 20L-70 35L-35 4M43 -34Q62 -22 77 22L58 34L34 2" fill="${dark}" stroke="${light}" stroke-opacity=".25"/>
    <path d="M-23 -105Q-24 -77 -7 -70H8Q25 -80 23 -105Z" fill="${mid}"/>
    <path d="M-23 -105Q-26 -140 0 -143Q30 -141 25 -105L14 -119L-5 -122Z" fill="#090f19" stroke="${light}" stroke-opacity=".38"/>
    <path d="M-16 -137Q-7 -158 8 -144L18 -130" fill="#090f19"/>
    ${female ? `<path d="M-20 -118Q-42 -88 -42 -42L-18 -57L-13 -116M20 -116Q42 -89 39 -38L20 -54L14 -117" fill="#0a1019"/><path d="M-38 -89Q-59 -77 -60 -45" fill="none" stroke="${light}" stroke-width="2"/>` : ''}
    ${crown ? `<path d="M-29 -136L-42 -162L-17 -150L0 -177L17 -150L40 -162L28 -136Z" fill="${mid}" stroke="${light}" stroke-width="2"/><circle cy="-155" r="4" fill="${light}"/>` : ''}
    ${child ? `<circle cx="-26" cy="-128" r="13" fill="#09121a" stroke="${light}" stroke-opacity=".45"/><circle cx="26" cy="-128" r="13" fill="#09121a" stroke="${light}" stroke-opacity=".45"/>` : ''}
    ${chef ? `<path d="M-26 -130L-30 -166Q-43 -188 -21 -194Q0 -217 22 -195Q45 -189 29 -165L26 -130Z" fill="${light}" opacity=".9"/><path d="M-24 -82L-20 70H28L22 -83" fill="${light}" opacity=".2"/><path d="M64 42L103 -75" stroke="${light}" stroke-width="7"/><ellipse cx="108" cy="-93" rx="15" ry="24" transform="rotate(17 108 -93)" fill="${mid}" stroke="${light}" stroke-width="2"/>` : ''}
    <path d="M-56 83Q-37 51 -27 -8M55 84Q39 55 29 4M-5 27L-10 92M8 35L16 95" fill="none" stroke="${light}" stroke-opacity=".13"/>
  </g>`;

  const mountains = `<path d="M-30 615L54 453L92 510L166 339L202 462L236 425L274 564L325 440L353 492L409 333L456 467L501 412L630 616V900H-30Z" fill="${mid}" opacity=".2"/><path d="M-30 696L45 528L115 611L166 486L252 660L329 541L385 604L456 481L539 650L630 536V900H-30Z" fill="${dark}" opacity=".85"/>`;
  const halo = (r = 171, cy = 327) => `<g class="world-halo"><circle cx="300" cy="${cy}" r="${r + 36}" fill="${url('aura')}"/><circle cx="300" cy="${cy}" r="${r}" fill="none" stroke="${light}" stroke-width="2" opacity=".7"/><circle cx="300" cy="${cy}" r="${r - 11}" fill="none" stroke="${light}" stroke-width=".8" opacity=".3"/><circle cx="300" cy="${cy}" r="${r + 13}" fill="none" stroke="${light}" stroke-dasharray="1 13" stroke-width="3" opacity=".65"/>${Array.from({ length: 12 }, (_, i) => `<path d="M300 ${cy-r-26}V${cy-r-45}" stroke="${light}" stroke-opacity=".65" transform="rotate(${i * 30} 300 ${cy})"/>`).join('')}</g>`;

  const scenes = {
    'underworld-heir': `${mountains}<ellipse cx="300" cy="512" rx="185" ry="340" fill="${url('aura')}"/><path d="M146 672V317L300 225L454 317V672" fill="${url('portal')}" stroke="${light}" stroke-width="3"/><path d="M169 672V330L300 251L430 330V672" fill="none" stroke="${light}" stroke-opacity=".32" stroke-width="1"/>${roof(300,302,407)}<path d="M141 314V675M457 314V675" stroke="${mid}" stroke-width="18"/>${lantern(120,425,.9)}${lantern(478,425,.9)}${lantern(56,548,.45)}${lantern(546,548,.45)}<g opacity=".2">${person({ y: 461, scale: 1.7, crown: true })}</g><path d="M127 690L220 626H380L480 690L577 841H25Z" fill="${url('floor')}"/>${[0,1,2,3,4,5].map(i=>`<path d="M${131-i*17} ${690+i*22}H${476+i*17}" stroke="${light}" stroke-opacity="${.3-i*.035}"/>`).join('')}${person({ scale: .83, y: 684 })}`,

    'myth-keeper': `${mountains}<ellipse cx="300" cy="330" rx="180" ry="265" fill="${url('aura')}"/>${halo(161,306)}<circle cx="300" cy="306" r="138" fill="${url('sun')}"/><g fill="${dark}" stroke="${light}" stroke-opacity=".4"><path d="M230 266L245 206L278 174L300 143L322 174L355 205L370 269L344 253L337 321L364 354L405 397L430 560H170L196 397L236 354L263 321L256 253Z"/><path d="M253 255L279 264L300 259L321 264L347 255L328 294L300 321L272 294Z" fill="${mid}" opacity=".4"/><path d="M273 268L287 270M313 270L327 268" stroke="${light}" stroke-width="4"/><path d="M300 207L303 227L298 227Z" fill="${light}"/><path d="M219 379L264 351L300 391L336 351L381 380M210 404L300 447L388 405" fill="none"/><path d="M453 188V624" stroke-width="6"/><path d="M453 190L430 151L431 114L449 138L453 97L458 138L476 114L476 151Z" fill="${mid}"/></g><path d="M55 760L265 549H335L560 760V900H55Z" fill="${url('floor')}"/>${Array.from({length:7},(_,i)=>`<path d="M${206-i*20} ${608+i*28}H${393+i*20}" stroke="${light}" stroke-opacity=".2"/>`).join('')}${person({ y: 714, scale: .76 })}<path d="M357 647Q416 610 433 654Q403 645 386 675" fill="none" stroke="${light}" stroke-opacity=".6" stroke-width="2"/>`,

    'ghost-player': `<circle cx="300" cy="247" r="107" fill="${url('sun')}"/><path d="M0 0L200 293V663L0 900Z M600 0L400 293V663L600 900Z" fill="${dark}" stroke="${mid}"/><path d="M204 670V359Q300 252 396 359V670Z" fill="${url('portal')}" stroke="${light}" stroke-width="3"/>${[0,1,2,3].map(i=>`<path d="M${50+i*35} ${120+i*47}L${50+i*35} ${820-i*51}M${550-i*35} ${120+i*47}L${550-i*35} ${820-i*51}" stroke="${secondary}" stroke-opacity=".16"/><path d="M${50+i*35} ${120+i*47}L${550-i*35} ${120+i*47}" stroke="${light}" stroke-opacity=".1"/>`).join('')}<path d="M200 660L0 900M400 660L600 900M300 660V900" stroke="${mid}"/><path d="M267 486Q274 443 297 445Q321 445 330 486L351 664Q307 682 248 664Z" fill="#983d50"/><ellipse cx="298" cy="446" rx="22" ry="29" fill="${light}" opacity=".6"/><path d="M274 450Q272 407 301 414Q328 417 324 455L307 443L288 432Z" fill="#171222"/>${person({x:267,y:739,scale:.73})}${lantern(97,231,.7)}${lantern(500,231,.7)}<path d="M-10 810Q165 751 246 796T626 786" fill="none" stroke="${light}" stroke-width="27" opacity=".07"/>`,

    'plot-rewriter': `${halo(174,320)}<path d="M107 277Q199 250 300 302Q391 251 491 277L452 564Q376 540 300 582Q225 540 147 564Z" fill="${url('book')}" stroke="${light}" stroke-width="2"/><path d="M300 302V580M111 298Q203 276 281 313L282 548Q212 524 163 535M490 299Q397 277 318 314V548Q399 522 439 536" fill="none" stroke="${light}" stroke-opacity=".35"/>${Array.from({length:7},(_,i)=>`<path d="M${149+i*2} ${326+i*26}Q210 ${314+i*27} 256 ${339+i*25}M344 ${339+i*25}Q394 ${315+i*27} ${451-i*2} ${326+i*26}" fill="none" stroke="${light}" stroke-opacity="${.15+(i%3)*.08}"/>`).join('')}<g fill="${light}" opacity=".65"><path d="M71 433L94 443L84 489L64 477Z"/><path d="M486 593L521 578L529 624L498 640Z"/><path d="M415 174L443 166L432 218L407 214Z"/></g><path d="M90 771Q373 590 504 391" fill="none" stroke="${light}" stroke-width="2" opacity=".55"/><path d="M329 685L428 485L441 478L443 490L341 693Z" fill="${light}" opacity=".65"/>${person({y:727,scale:.78})}`,

    'hidden-player': `<g opacity=".12">${Array.from({length:13},(_,i)=>`<path d="M${i*50} 0V900M0 ${i*70}H600" stroke="${secondary}"/>`).join('')}</g><path d="M-50 780L300 552L650 780M-50 843L300 552L650 843M100 900L300 552L500 900" fill="none" stroke="${secondary}" stroke-opacity=".3"/>${halo(155,340)}<path d="M183 187H417L470 237V507L417 559H183L130 507V239Z" fill="${url('portal')}" stroke="${light}" stroke-width="2"/><path d="M165 258V221H211M389 221H435V258M435 487V524H393M206 524H165V487" fill="none" stroke="${secondary}" stroke-width="5"/><path d="M314 241L243 357H296L283 446L362 325H310Z" fill="${light}"/><path d="M181 470H419" stroke="${light}" stroke-opacity=".2"/>${Array.from({length:12},(_,i)=>`<rect x="${182+i*20}" y="485" width="11" height="10" rx="1" fill="${i<10?light:mid}" opacity=".8"/>`).join('')}<g fill="${dark}" stroke="${secondary}" stroke-opacity=".55"><path d="M55 303H105V360H55Z"/><path d="M478 452H549V498H478Z"/><path d="M71 535H128V592H71Z"/></g><path d="M55 329H130M470 475H548M100 533V495H150" fill="none" stroke="${light}" stroke-opacity=".4"/>${person({y:722,scale:.8})}`,

    'reborn-queen': `<circle cx="300" cy="282" r="135" fill="${url('sun')}"/>${roof(300,321,467)}${roof(93,497,264,.9)}${roof(505,497,264,.9)}<path d="M0 38Q117 167 103 421L0 689Z M600 38Q483 167 497 421L600 689Z" fill="#743d51" opacity=".7"/><path d="M0 55Q76 181 78 446M600 55Q524 181 522 446" fill="none" stroke="${light}" stroke-opacity=".33" stroke-width="2"/><path d="M69 873L224 573H376L531 873Z" fill="${url('floor')}"/>${[0,1,2,3,4,5].map(i=>`<path d="M${207-i*24} ${610+i*43}H${393+i*24}" stroke="${light}" stroke-opacity=".2"/>`).join('')}${[0,1,2,3,4].map(i=>`<path d="M${225+i*37} 575L${70+i*116} 873" stroke="${light}" stroke-opacity=".2"/>`).join('')}<g fill="${mid}" stroke="${light}" stroke-opacity=".55"><path d="M83 764L95 730L101 687L90 672L97 649L116 665L137 649L143 673L132 687L137 730L151 764Z"/><path d="M472 718L482 696L488 660L480 649L489 632H508L515 649L506 660L511 696L520 718Z"/></g>${person({y:691,scale:1.05,female:true,crown:true})}${lantern(163,375,.57)}${lantern(438,375,.57)}`,

    'mind-reader': `${roof(300,376,494)}<circle cx="300" cy="277" r="138" fill="${url('aura')}"/>${[140,170,207].map(r=>`<ellipse cx="300" cy="286" rx="${r}" ry="${r*.66}" fill="none" stroke="${light}" stroke-opacity=".35" transform="rotate(-22 300 286)"/>`).join('')}<path d="M286 212C260 176 216 206 239 238L300 289L361 238C385 207 339 175 316 212L300 230Z" fill="${light}" opacity=".8"/><path d="M138 498Q124 449 87 423M462 498Q476 449 513 423" fill="none" stroke="${secondary}" stroke-width="2" stroke-dasharray="4 8"/>${lantern(86,321,.68)}${lantern(520,332,.68)}<g opacity=".6">${person({x:114,y:625,scale:.47,crown:true})}${person({x:487,y:625,scale:.47})}</g>${person({y:716,scale:.93,female:true})}<g fill="${light}"><circle cx="152" cy="252" r="4"/><circle cx="442" cy="224" r="5"/><path d="M184 398L191 414L208 420L191 427L184 443L177 427L162 420L177 414Z"/></g>`,

    'chaos-director': `<circle cx="298" cy="312" r="146" fill="${url('sun')}"/><g transform="rotate(-24 300 312)"><ellipse cx="300" cy="312" rx="226" ry="52" fill="none" stroke="${secondary}" stroke-width="18" opacity=".55"/><ellipse cx="300" cy="312" rx="226" ry="52" fill="none" stroke="${light}" stroke-width="2"/></g><circle cx="257" cy="287" r="12" fill="${dark}"/><circle cx="340" cy="287" r="12" fill="${dark}"/><path d="M250 339Q298 391 347 339" fill="none" stroke="${dark}" stroke-width="9" stroke-linecap="round"/><g fill="${mid}" stroke="${light}" stroke-opacity=".65"><path d="M63 445L163 414L189 467L132 535Z"/><path d="M423 544L507 519L548 563L477 619Z"/><path d="M393 126L449 104L474 146L423 177Z"/></g><path d="M31 670H78V640H125V610H172V580H219" fill="none" stroke="${secondary}" stroke-width="12" opacity=".5"/><path d="M420 386L485 422" stroke="${light}" stroke-width="9"/><ellipse cx="491" cy="426" rx="34" ry="20" transform="rotate(28 491 426)" fill="${mid}" stroke="${light}" stroke-width="2"/>${person({y:736,scale:.82})}<path d="M236 679L180 554" stroke="${light}" stroke-width="7"/><ellipse cx="171" cy="535" rx="20" ry="34" transform="rotate(-25 171 535)" fill="${mid}" stroke="${light}" stroke-width="2"/>`,

    'spirit-child': `${mountains}<circle cx="300" cy="305" r="132" fill="${url('sun')}"/><path d="M28 534Q165 477 240 528T595 496M-15 586Q108 527 263 574T643 539M3 658Q156 611 296 650T600 615" fill="none" stroke="${light}" stroke-width="20" opacity=".12"/>${roof(447,446,171,.6)}<g fill="${secondary}" fill-opacity=".13" stroke="${light}" stroke-opacity=".53" stroke-width="2"><path d="M180 431L171 360L229 386Q301 361 371 386L429 360L420 431Q449 474 417 526L371 567L300 595L229 567L182 526Q149 477 180 431Z"/><path d="M193 453L254 463L234 480L202 475M407 453L346 463L366 480L398 475" fill="${light}" fill-opacity=".8"/><path d="M268 525L300 511L332 525L300 550Z" fill="${light}" fill-opacity=".55"/><path d="M300 550V566L277 577M300 566L323 577M273 398L300 430L328 398M269 424L300 452L330 424M225 502L267 514M375 502L333 514" fill="none"/></g><path d="M171 792Q209 722 300 732Q386 720 430 792Z" fill="${mid}" opacity=".6"/>${person({y:711,scale:.64,female:true,child:true})}<path d="M285 785Q229 730 215 745Q194 775 249 802M315 785Q371 730 385 745Q406 775 351 802M259 809Q300 743 341 809" fill="none" stroke="${light}" stroke-opacity=".4"/>`,

    'royal-chef': `${roof(300,262,553)}<path d="M74 287V765M525 287V765" stroke="${mid}" stroke-width="18"/>${lantern(116,386,.91)}${lantern(486,386,.91)}<circle cx="300" cy="342" r="117" fill="${url('aura')}"/><path d="M161 540Q300 584 439 540Q418 668 302 678Q177 668 161 540Z" fill="${url('robe')}" stroke="${light}" stroke-width="2"/><ellipse cx="300" cy="541" rx="140" ry="29" fill="${mid}" fill-opacity=".45" stroke="${light}" stroke-width="2"/><path d="M276 536L300 438L325 536M255 537L275 483L290 539M310 539L328 484L347 539" fill="${light}" opacity=".77"/><g fill="none" stroke="${light}" stroke-linecap="round"><path d="M230 490C195 451 266 416 225 365" stroke-width="4" opacity=".3"/><path d="M302 410C255 366 341 333 291 292" stroke-width="5" opacity=".4"/><path d="M362 475C410 424 341 394 380 348" stroke-width="3" opacity=".3"/></g><g fill="${light}" opacity=".7">${Array.from({length:12},(_,i)=>`<circle cx="${224+(i*43)%158}" cy="${331+(i*31)%175}" r="${1+i%3}"/>`).join('')}</g>${person({y:759,scale:.73,chef:true})}`,
  };


  const objects = {
    'villain-calmer': `<path d="M220 330H366V416Q366 465 294 465Q220 465 220 416Z" fill="${mid}" stroke="${light}" stroke-width="3"/><path d="M366 350H392Q430 350 420 390Q412 415 367 411M212 480H383M266 310Q240 278 272 246M314 310Q290 275 318 238" fill="none" stroke="${light}" stroke-width="4"/>`,
    'immortal-support': `<path d="M277 515L305 245L320 203L332 247L305 519Z" fill="${mid}" stroke="${light}" stroke-width="3"/><path d="M255 492L324 504M274 550L300 549" stroke="${light}" stroke-width="7"/><circle cx="416" cy="358" r="52" stroke="${secondary}" stroke-width="13" stroke-dasharray="12 12"/><circle cx="416" cy="358" r="23" stroke="${light}" stroke-width="3"/>`,
    'apocalypse-caterer': `<rect x="187" y="338" width="228" height="156" rx="19" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M210 338V304H390V338M186 375H415M250 421H350" fill="none" stroke="${secondary}" stroke-width="6"/><path d="M241 282Q219 257 246 229M299 282Q276 245 305 214M355 282Q337 253 365 228" fill="none" stroke="${light}" stroke-width="4"/>`,
    'lucky-disaster': `<path d="M186 363L300 303L414 363V491L300 544L186 491Z" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M185 363L176 290L300 230L415 290L414 363M300 422V542M185 363L300 422L414 363" fill="none" stroke="${secondary}" stroke-width="3"/><path d="M300 282L314 318L352 330L315 343L300 380L286 343L249 330L287 318Z" fill="${light}"/>`,
    'contract-judge': `<path d="M205 258H375L408 289V500H205Z" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M375 258V289H408M237 325H360M237 357H347M237 389H316M238 446L264 468L329 417" fill="none" stroke="${secondary}" stroke-width="5"/><circle cx="397" cy="481" r="44" fill="${mid}" stroke="${light}" stroke-width="3"/>`,
    'social-shield': `<path d="M300 228L419 276V371Q419 468 300 521Q181 468 181 371V276Z" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M281 304L261 390H310L292 459L351 361H303L324 304Z" fill="${secondary}" opacity=".8"/><ellipse cx="300" cy="561" rx="204" ry="62" stroke="${light}" stroke-opacity=".6"/>`,
    'dragon-office-worker': `<circle cx="301" cy="301" r="85" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M301 238V302L347 328" stroke="${secondary}" stroke-width="7"/><rect x="214" y="427" width="181" height="128" rx="9" fill="${mid}" stroke="${light}" stroke-width="3"/><path d="M266 427V399Q302 375 340 399V427M219 469H391" fill="none" stroke="${light}" stroke-width="4"/>`,
    'spotlight-extra': `<rect x="185" y="284" width="208" height="132" rx="12" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M393 322L457 292V406L393 375Z" fill="${mid}" stroke="${secondary}" stroke-width="3"/><circle cx="248" cy="258" r="34" stroke="${light}" stroke-width="6"/><circle cx="332" cy="255" r="39" stroke="${light}" stroke-width="6"/><path d="M285 419V540M245 568L285 490L327 568" stroke="${light}" stroke-width="5"/>`,
    'heaven-admin': `<rect x="164" y="252" width="273" height="221" rx="13" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M164 299H437M210 335H276M210 370H327M210 405H257" stroke="${secondary}" stroke-width="5"/><circle cx="365" cy="383" r="35" stroke="${light}" stroke-width="3"/><path d="M346 383L361 398L386 367M241 522H363M276 474V522M330 474V522" fill="none" stroke="${light}" stroke-width="4"/>`,
    'cosmic-director': `<path d="M184 298L393 236L412 300L203 362Z" fill="${mid}" stroke="${light}" stroke-width="3"/><path d="M208 291L242 345M265 274L299 328M321 257L355 311M377 241L404 294" stroke="${light}" stroke-width="13"/><rect x="200" y="362" width="219" height="153" rx="7" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M230 403H391M230 448H332M230 479H370" stroke="${secondary}" stroke-width="3"/>`,
  };
  if (objects[role.id]) {
    const female = ['villain-calmer','apocalypse-caterer','lucky-disaster','social-shield','heaven-admin'].includes(role.id);
    scenes[role.id] = `${mountains}${halo(181,355)}${objects[role.id]}<path d="M63 828L225 611H376L541 828" fill="${url('floor')}" stroke="${light}" stroke-opacity=".25"/>${person({y:756,scale:.72,female})}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${key}-sky" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#070c17"/><stop offset=".55" stop-color="${dark}"/><stop offset="1" stop-color="#080e18"/></linearGradient>
      <radialGradient id="${key}-aura"><stop stop-color="${light}" stop-opacity=".45"/><stop offset=".38" stop-color="${mid}" stop-opacity=".3"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${key}-sun" cx=".5" cy=".4" r=".65"><stop stop-color="${light}" stop-opacity=".75"/><stop offset=".65" stop-color="${mid}" stop-opacity=".6"/><stop offset="1" stop-color="${mid}" stop-opacity=".1"/></radialGradient>
      <radialGradient id="${key}-lantern"><stop stop-color="${light}" stop-opacity=".45"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${key}-robe"><stop stop-color="${dark}"/><stop offset=".4" stop-color="#101d2b"/><stop offset=".83" stop-color="${mid}" stop-opacity=".65"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="${key}-portal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${mid}" stop-opacity=".4"/><stop offset="1" stop-color="${light}" stop-opacity=".14"/></linearGradient>
      <linearGradient id="${key}-floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${light}" stop-opacity=".13"/><stop offset="1" stop-color="#080e18"/></linearGradient>
      <linearGradient id="${key}-book"><stop stop-color="${mid}" stop-opacity=".45"/><stop offset=".5" stop-color="${dark}"/><stop offset="1" stop-color="${mid}" stop-opacity=".6"/></linearGradient>
      <linearGradient id="${key}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".65" stop-color="#080e18" stop-opacity="0"/><stop offset="1" stop-color="#080e18" stop-opacity=".96"/></linearGradient>
    </defs>
    <path fill="${url('sky')}" d="M0 0H600V900H0Z"/>
    <ellipse cx="300" cy="382" rx="369" ry="403" fill="${url('aura')}" opacity=".5"/>
    <g class="world-stars">${stars}</g>
    ${scenes[role.id]}
    <path d="M-70 744Q121 652 293 728T675 667M-25 810Q145 718 327 794T646 735" fill="none" stroke="${secondary}" stroke-width="35" stroke-opacity=".04"/>
    <path fill="${url('fade')}" d="M0 0H600V900H0Z"/>
    <g stroke="${light}" stroke-opacity=".2"><path d="M30 72V30H72M528 30H570V72M30 828V870H72M528 870H570V828" stroke-width="1"/></g>
  </svg>`;
}
