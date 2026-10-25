import React from 'react';
import {registerRoot, Composition, AbsoluteFill, Interactive, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

const ink = '#092F35';
const skin = '#FFB19C';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const smooth = {...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1)};

const Spark = ({x,y,size,delay=0}: {x:number;y:number;size:number;delay?:number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = interpolate(frame, [(3.05+delay)*fps,(3.4+delay)*fps,(4.4+delay)*fps,5*fps], [0,1,.8,.65], smooth);
  return <g transform={`translate(${x} ${y}) scale(${s})`}><path d={`M0 ${-size} Q3 -3 ${size} 0 Q3 3 0 ${size} Q-3 3 ${-size} 0 Q-3 -3 0 ${-size}`} fill="#FFF9EF"/></g>;
};

const Illustration = ({dashboard = false}: {dashboard?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const working = dashboard
    ? interpolate(frame,[0,.6*fps,.9*fps,2.55*fps,2.9*fps,4.5*fps,5*fps],[0,0,1,1,0,0,0],clamp)
    : interpolate(frame,[.6*fps,.9*fps,2.55*fps,2.9*fps],[0,1,1,0],clamp);
  const bob = Math.sin(t * Math.PI * 3.3) * 3.5 * working;
  const close = interpolate(frame,[1*fps,1.2*fps,1.45*fps,1.7*fps,1.92*fps,2.2*fps],[0,1,0,0,1,0],smooth);
  const join = dashboard ? interpolate(frame,[2.35*fps,2.75*fps,4.5*fps,4.95*fps],[0,1,1,0],smooth) : interpolate(frame,[2.35*fps,2.75*fps],[0,1],smooth);
  const done = dashboard ? interpolate(frame,[2.9*fps,3.18*fps,4.45*fps,4.95*fps],[0,1,1,0],smooth) : interpolate(frame,[2.9*fps,3.18*fps],[0,1],smooth);
  const proud = dashboard ? interpolate(frame,[3*fps,3.5*fps,4.4*fps,4.95*fps],[0,1,1,0],smooth) : interpolate(frame,[3*fps,3.5*fps],[0,1],smooth);
  const blink = (t > 1.42 && t < 1.55) || (t>4.32 && t<4.44);
  return <svg viewBox={dashboard ? '60 205 960 640' : '0 0 1080 1080'} width={dashboard ? 960 : 1080} height={dashboard ? 640 : 1080} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="scene-mask"><rect x="88" y="210" width="904" height="625" rx="150"/></clipPath><clipPath id="background-mask"><rect x="88" y="245" width="904" height="590" rx="150"/></clipPath></defs>
    <g style={{transformOrigin:'540px 550px',scale:dashboard ? 1 : interpolate(frame,[0,.55*fps],[.88,1],smooth),opacity:dashboard ? 1 : interpolate(frame,[0,.2*fps],[0,1],clamp)}}>
      <rect x="88" y="245" width="904" height="590" rx="150" fill="#078D9F"/>
      <g clipPath="url(#scene-mask)">
        <path d="M50 696 C194 537 285 843 482 728 C713 582 815 646 1042 500 L1042 900 H50Z" fill="#007484"/>
        <circle cx="860" cy="300" r="169" fill="#18A1AE" clipPath="url(#background-mask)"/>
        <path d="M97 480 C164 480 164 365 231 365 H290" stroke="#54BDC5" strokeWidth="4" strokeDasharray="8 15" opacity=".65"/>
        <circle cx="296" cy="365" r="7" fill="#B3E9D8"/>
        <ellipse cx="538" cy="825" rx="348" ry="33" fill="#075E68"/>
        {/* Character: trousers and utility belt. */}
        <path d="M335 710 L563 715 L590 869 H311Z" fill={ink}/>
        <path d="M452 756 L462 868 M365 793 L347 852" stroke="#447078" strokeWidth="5" strokeLinecap="round"/>
        <g transform={`translate(0 ${bob})`}>
          {/* Back arm, shirt and reflective vest. */}
          <path d="M514 478 Q563 458 591 508 L641 578 L593 611 L529 553Z" fill="#00A955"/>
          <path d="M577 533 L608 576" stroke="#DCF490" strokeWidth="17"/>
          <path d="M369 458 Q420 444 474 454 Q529 457 550 500 L574 727 Q464 763 328 725 L325 523 Q324 479 369 458Z" fill="#00BD68"/>
          <path d="M368 463 L385 469 L374 731 L343 727Z M493 459 L518 470 L546 734 L518 741Z" fill="#DAF18E"/>
          <path d="M445 500 L452 741" stroke={ink} strokeWidth="5"/>
          <path d="M381 466 L409 447 L443 494 L415 520Z M443 494 L469 450 L493 462 L471 516Z" fill="#008744"/>
          <path d="M475 537 H511 V581 Q492 593 475 581Z" fill="#008D50"/>
          <path d="M483 548 H502" stroke="#D9F28C" strokeWidth="5" strokeLinecap="round"/>
          <rect x="333" y="713" width="235" height="22" rx="7" fill={ink}/>
          <rect x="433" y="710" width="37" height="27" rx="4" fill="#FFCE4B"/>
          <rect x="443" y="717" width="17" height="13" rx="2" fill={ink}/>
          <path d="M344 699 H386 V765 Q365 782 344 765Z" fill="#F58D36"/>
          <path d="M355 693 V732 M374 683 V732" stroke={ink} strokeWidth="9" strokeLinecap="round"/>
          {/* Neck, face and helmet, nodding toward the repair. */}
          <g transform={`rotate(${4*working-3*proud} 444 448)`}>
            <path d="M414 410 L411 460 Q437 492 470 454 L466 403Z" fill={skin}/>
            <path d="M419 419 Q445 444 469 422 L470 438 Q447 460 416 440Z" fill="#E38073"/>
            <path d="M376 319 Q369 267 435 264 Q508 261 515 324 L503 389 L397 404Z" fill={ink}/>
            <path d="M401 310 Q427 287 486 312 L503 356 Q523 366 509 379 L498 384 Q494 428 459 435 Q418 441 400 404 L386 366Z" fill={skin}/>
            <ellipse cx="390" cy="368" rx="20" ry="25" fill={skin}/>
            <path d="M388 379 Q378 363 392 360 M488 351 L489 373 L480 377" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M400 322 L400 360 L390 345 L382 334Z" fill={ink}/>
            <path d="M425 338 Q437 331 448 338 M474 336 Q484 331 491 338" stroke={ink} strokeWidth="7" strokeLinecap="round"/>
            {blink ? <path d="M430 354 L442 356 M475 354 L486 353" stroke={ink} strokeWidth="5" strokeLinecap="round"/> : <><ellipse cx="438" cy="354" rx="11" ry="9" fill="#FFF9EF"/><ellipse cx="481" cy="352" rx="9" ry="8" fill="#FFF9EF"/><ellipse cx="442" cy="356" rx="4" ry="6" fill={ink}/><ellipse cx="484" cy="354" rx="3.5" ry="5.5" fill={ink}/></>}
            <ellipse cx="421" cy="379" rx="13" ry="7" fill="#F18C7E"/>
            <path d="M446 393 Q464 402 482 390 Q480 417 461 413 Q450 409 446 393Z" fill={ink}/>
            <path d="M450 395 Q465 400 479 393 L475 401 Q463 405 452 400Z" fill="#FFF9EF"/>
            <path d="M368 319 Q366 257 413 242 Q466 222 500 266 Q516 286 516 319Z" fill="#FFBC32"/>
            <path d="M440 239 Q470 267 473 309" stroke="#FFE7A1" strokeWidth="13" strokeLinecap="round"/>
            <path d="M397 259 Q385 282 386 306" stroke="#FFE7A1" strokeWidth="8" strokeLinecap="round"/>
            <path d="M361 311 Q429 294 517 313 L530 326 Q533 336 521 338 Q436 319 368 337 Q352 338 353 327Z" fill="#FFCE4B"/>
            <path d="M382 331 Q439 320 489 328" stroke="#E38F24" strokeWidth="4" strokeLinecap="round"/>
          </g>
          {/* Holding arm. */}
          <path d="M348 492 Q320 489 303 521 L281 583 Q274 614 302 628 Q330 640 348 608 L379 545Z" fill="#00A955"/>
          <path d="M304 550 L351 571" stroke="#DAF18E" strokeWidth="17"/>
          <path d="M294 600 Q298 579 321 587 L388 614 Q421 622 459 599 L510 574 L529 609 Q454 664 403 660 Q367 657 304 629 Q289 623 294 600Z" fill={skin}/>
          <path d="M308 626 Q374 651 402 650" stroke="#E38576" strokeWidth="4" strokeLinecap="round"/>
          {/* Network cable. The two ends join after the crimp. */}
          <path d="M535 586 C487 587 495 694 466 704 C430 716 400 697 399 728 C396 764 465 775 499 746" stroke={ink} strokeWidth="17" strokeLinecap="round"/>
          <path d="M535 586 C487 587 495 694 466 704 C430 716 400 697 399 728 C396 764 465 775 499 746" stroke="#FFCC49" strokeWidth="10" strokeLinecap="round"/>
          <path d={`M${631-join*28} 586 C694 586 624 679 667 719 S735 759 764 741`} stroke={ink} strokeWidth="17" strokeLinecap="round"/>
          <path d={`M${631-join*28} 586 C694 586 624 679 667 719 S735 759 764 741`} stroke="#FFCC49" strokeWidth="10" strokeLinecap="round"/>
          <path d="M510 576 Q525 560 543 562 L567 568 Q578 573 573 581 Q571 588 560 584 L548 581 L550 592 L567 594 Q580 598 574 607 Q571 614 558 613 L530 610 Q506 611 510 591Z" fill={skin}/>
          <path d="M535 585 L546 590 M533 599 L547 601" stroke="#B55C52" strokeWidth="3" strokeLinecap="round"/>
          <rect x="568" y="574" width="35" height="24" rx="5" fill="#E1F7E5" stroke={ink} strokeWidth="4"/>
          <rect x="579" y="568" width="17" height="7" rx="2" fill="#FFF9EF"/>
          <path d="M575 580 V591 M583 580 V591 M591 580 V591" stroke="#E5AF35" strokeWidth="3"/>
          <g transform={`translate(${-join*28} 0)`}><rect x="621" y="575" width="25" height="23" rx="4" fill="#E1F7E5" stroke={ink} strokeWidth="4"/><path d="M626 581 V591 M634 581 V591" stroke="#E5AF35" strokeWidth="3"/></g>
          {/* Repairing hand and two squeezes of the crimping pliers. */}
          <g opacity={1-done} transform={`translate(0 ${-close*4})`}>
            <path d="M584 530 Q602 529 622 547 L648 523 Q665 510 678 524 Q688 538 673 552 L636 584 Q623 594 609 582 L578 557Z" fill={skin}/>
            <g transform="translate(607 563) rotate(-146)">
              <path d="M-10 0 L-22 -28 L-12 -49 L0 -29 L12 -49 L22 -28 L10 0Z" fill={ink}/>
              <path d="M-8 -15 L-13 -28 L-9 -35 M8 -15 L13 -28 L9 -35" stroke="#81B4BD" strokeWidth="5" strokeLinecap="round"/>
              <g transform={`rotate(${-20+close*16} 0 -5)`}><path d="M-6 -5 L-20 62" stroke={ink} strokeWidth="17" strokeLinecap="round"/><path d="M-15 30 L-21 64" stroke="#F47B45" strokeWidth="14" strokeLinecap="round"/></g>
              <g transform={`rotate(${20-close*16} 0 -5)`}><path d="M6 -5 L20 62" stroke={ink} strokeWidth="17" strokeLinecap="round"/><path d="M15 30 L21 64" stroke="#F47B45" strokeWidth="14" strokeLinecap="round"/></g>
              <circle cy="-5" r="6" fill="#C5E2DF"/>
            </g>
            <path d="M627 550 Q635 535 645 541 L659 551 Q667 559 661 565 Q657 569 649 564 L638 556 Q635 566 626 563Z" fill={skin}/>
          </g>
          {/* Final approval gesture. */}
          <g opacity={done} transform={`translate(${(1-proud)*-20} ${(1-proud)*65}) rotate(${(1-proud)*-12} 612 542)`}>
            <path d="M585 536 Q603 550 615 531 L636 490 L665 505 L645 554 Q631 588 606 577 L580 559Z" fill={skin}/>
            <path d="M632 503 L629 484 Q627 476 636 469 L648 455 L647 434 Q647 423 657 422 Q668 422 670 435 L674 459 L688 460 Q700 461 698 475 L692 501 Q690 512 678 514 L650 512Z" fill={skin}/>
            <path d="M674 472 L692 474 M673 484 L690 486 M670 496 L686 498" stroke="#BA665B" strokeWidth="3" strokeLinecap="round"/>
          </g>
        </g>
        {/* Router sits on a warm yellow work surface. */}
        <path d="M640 782 H980 V801 H640Z" fill="#FFCD4A"/>
        <path d="M679 800 L669 860 M921 800 L936 860" stroke={ink} strokeWidth="13"/>
        <path d="M721 697 L699 603 M865 693 L887 595" stroke={ink} strokeWidth="17" strokeLinecap="round"/>
        <path d="M721 696 L703 618 M865 693 L883 610" stroke="#D9EEE2" strokeWidth="8" strokeLinecap="round"/>
        <path d="M711 689 H866 Q883 690 889 704 L907 750 H682 L696 706 Q700 692 711 689Z" fill="#FFF9EF"/>
        <rect x="681" y="732" width="227" height="46" rx="15" fill="#CAE7D9"/>
        <path d="M737 711 H846 M743 720 H852" stroke="#A8D0C5" strokeWidth="4" strokeLinecap="round"/>
        <rect x="763" y="744" width="26" height="15" rx="3" fill={ink}/>
        <path d="M767 752 H780" stroke="#FFCC49" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="813" cy="754" r="5" fill={done>.3?'#00B968':'#ED925D'}/>
        <circle cx="831" cy="754" r="5" fill={done>.5?'#00B968':'#8FB7AD'}/>
        <circle cx="849" cy="754" r="5" fill={done>.8?'#00B968':'#8FB7AD'}/>
        {/* Tool bag in the foreground. */}
        <path d="M190 742 V713 Q191 698 208 698 H244 Q260 698 260 714 V742" stroke={ink} strokeWidth="13"/>
        <path d="M172 735 Q172 726 183 726 H275 Q287 726 289 739 L301 810 H159Z" fill="#F99C36"/>
        <path d="M165 776 H294 L301 810 H159Z" fill="#EC7B28"/>
        <path d="M188 731 L188 809 M263 731 L270 809" stroke="#FFCF62" strokeWidth="12"/>
        <rect x="208" y="762" width="38" height="27" rx="5" fill={ink}/>
        <path d="M221 770 L234 783 M234 770 L221 783" stroke="#FFE2A1" strokeWidth="4" strokeLinecap="round"/>
      </g>
      {/* Wireless signal grows out of the router after the cable connects. */}
      <g transform={`translate(797 473) scale(${interpolate(frame,[2.85*fps,3.35*fps],[.6,1],smooth)})`} opacity={done}>
        <circle r="93" fill="#DDF397"/>
        <path d="M-52 -10 Q0 -57 52 -10" stroke={ink} strokeWidth="12" strokeLinecap="round" opacity={interpolate(frame,[3.35*fps,3.6*fps],[0,1],clamp)}/>
        <path d="M-32 12 Q0 -16 32 12" stroke={ink} strokeWidth="12" strokeLinecap="round" opacity={interpolate(frame,[3.18*fps,3.43*fps],[0,1],clamp)}/>
        <circle cy="36" r="9" fill={ink}/>
      </g>
      {/* Small graphic accents keep attention on the repair. */}
      <g opacity={interpolate(frame,[2.7*fps,2.83*fps,3.12*fps],[0,1,0],clamp)} stroke="#FFF9EF" strokeWidth="6" strokeLinecap="round">
        <path d="M604 554 V541 M621 559 L631 549 M613 615 L619 627"/>
      </g>
      <g opacity={dashboard ? interpolate(frame,[4.4*fps,4.95*fps],[1,0],smooth) : 1}>
        <Spark x={221} y={450} size={25}/><Spark x={910} y={570} size={20} delay={.15}/><Spark x={623} y={333} size={19} delay={.1}/><Spark x={151} y={676} size={15} delay={.25}/>
      </g>
      <circle cx="279" cy="319" r="7" fill="#B9ECDE"/><circle cx="931" cy="678" r="6" fill="#B9ECDE"/>
    </g>
  </svg>;
};

const TechnicianBumper = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor:'#FFF9EF',fontFamily:'Arial, sans-serif',color:ink}}>
    <Interactive.Div name="Judul bumper" premountFor={fps} style={{position:'absolute',top:112,width:'100%',textAlign:'center',fontSize:84,fontWeight:800,letterSpacing:-4,opacity:interpolate(frame,[0,.4*fps],[0,1],clamp),translate:interpolate(frame,[0,.6*fps],['0px 18px','0px 0px'],smooth)}}>Sebentar, ya.</Interactive.Div>
    <Interactive.Div name="Teknisi memperbaiki kabel" premountFor={fps} style={{position:'absolute',inset:0}}><Illustration/></Interactive.Div>
    <Interactive.Div name="Pesan layanan" premountFor={fps} style={{position:'absolute',top:891,width:'100%',textAlign:'center',fontSize:44,fontWeight:600,letterSpacing:-1,opacity:interpolate(frame,[.3*fps,.65*fps],[0,1],clamp)}}>Koneksi lagi kami beresin.</Interactive.Div>
    <Interactive.Div name="Titik tunggu" premountFor={fps} style={{position:'absolute',top:971,left:505,display:'flex',gap:13}}>
      {[0,1,2].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,backgroundColor:'#00AB60',opacity:.35+.65*Math.pow((Math.sin(tick(frame,fps,i))+1)/2,2),translate:`0px ${-4*Math.max(0,Math.sin(tick(frame,fps,i)))}px`}}/>)}
    </Interactive.Div>
  </AbsoluteFill>;
};
const tick=(frame:number,fps:number,i:number)=>frame/fps*5-i*.9;
const TechnicianDashboard = () => <AbsoluteFill style={{backgroundColor:'#FFF9EF'}}><Illustration dashboard/></AbsoluteFill>;
const Root = () => <>
  <Composition id="TechnicianBumper" component={TechnicianBumper} width={1080} height={1080} fps={30} durationInFrames={150} />
  <Composition id="TechnicianDashboard" component={TechnicianDashboard} width={960} height={640} fps={30} durationInFrames={150} />
</>;
registerRoot(Root);
