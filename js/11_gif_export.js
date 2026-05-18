// ─────────────────────────────────────────────
// GIF EXPORT + JSON EMBEDDING  (js/11_gif_export.js)
// ─────────────────────────────────────────────

// gif.worker.js source eingebettet als Inline-String (funktioniert mit file://)
const _GIF_WORKER_SRC = "// gif.worker.js 0.2.0 - https://github.com/jnordberg/gif.js\n(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require==\"function\"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error(\"Cannot find module '\"+o+\"'\");throw f.code=\"MODULE_NOT_FOUND\",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require==\"function\"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){var NeuQuant=require(\"./TypedNeuQuant.js\");var LZWEncoder=require(\"./LZWEncoder.js\");function ByteArray(){this.page=-1;this.pages=[];this.newPage()}ByteArray.pageSize=4096;ByteArray.charMap={};for(var i=0;i<256;i++)ByteArray.charMap[i]=String.fromCharCode(i);ByteArray.prototype.newPage=function(){this.pages[++this.page]=new Uint8Array(ByteArray.pageSize);this.cursor=0};ByteArray.prototype.getData=function(){var rv=\"\";for(var p=0;p<this.pages.length;p++){for(var i=0;i<ByteArray.pageSize;i++){rv+=ByteArray.charMap[this.pages[p][i]]}}return rv};ByteArray.prototype.writeByte=function(val){if(this.cursor>=ByteArray.pageSize)this.newPage();this.pages[this.page][this.cursor++]=val};ByteArray.prototype.writeUTFBytes=function(string){for(var l=string.length,i=0;i<l;i++)this.writeByte(string.charCodeAt(i))};ByteArray.prototype.writeBytes=function(array,offset,length){for(var l=length||array.length,i=offset||0;i<l;i++)this.writeByte(array[i])};function GIFEncoder(width,height){this.width=~~width;this.height=~~height;this.transparent=null;this.transIndex=0;this.repeat=-1;this.delay=0;this.image=null;this.pixels=null;this.indexedPixels=null;this.colorDepth=null;this.colorTab=null;this.neuQuant=null;this.usedEntry=new Array;this.palSize=7;this.dispose=-1;this.firstFrame=true;this.sample=10;this.dither=false;this.globalPalette=false;this.out=new ByteArray}GIFEncoder.prototype.setDelay=function(milliseconds){this.delay=Math.round(milliseconds/10)};GIFEncoder.prototype.setFrameRate=function(fps){this.delay=Math.round(100/fps)};GIFEncoder.prototype.setDispose=function(disposalCode){if(disposalCode>=0)this.dispose=disposalCode};GIFEncoder.prototype.setRepeat=function(repeat){this.repeat=repeat};GIFEncoder.prototype.setTransparent=function(color){this.transparent=color};GIFEncoder.prototype.addFrame=function(imageData){this.image=imageData;this.colorTab=this.globalPalette&&this.globalPalette.slice?this.globalPalette:null;this.getImagePixels();this.analyzePixels();if(this.globalPalette===true)this.globalPalette=this.colorTab;if(this.firstFrame){this.writeLSD();this.writePalette();if(this.repeat>=0){this.writeNetscapeExt()}}this.writeGraphicCtrlExt();this.writeImageDesc();if(!this.firstFrame&&!this.globalPalette)this.writePalette();this.writePixels();this.firstFrame=false};GIFEncoder.prototype.finish=function(){this.out.writeByte(59)};GIFEncoder.prototype.setQuality=function(quality){if(quality<1)quality=1;this.sample=quality};GIFEncoder.prototype.setDither=function(dither){if(dither===true)dither=\"FloydSteinberg\";this.dither=dither};GIFEncoder.prototype.setGlobalPalette=function(palette){this.globalPalette=palette};GIFEncoder.prototype.getGlobalPalette=function(){return this.globalPalette&&this.globalPalette.slice&&this.globalPalette.slice(0)||this.globalPalette};GIFEncoder.prototype.writeHeader=function(){this.out.writeUTFBytes(\"GIF89a\")};GIFEncoder.prototype.analyzePixels=function(){if(!this.colorTab){this.neuQuant=new NeuQuant(this.pixels,this.sample);this.neuQuant.buildColormap();this.colorTab=this.neuQuant.getColormap()}if(this.dither){this.ditherPixels(this.dither.replace(\"-serpentine\",\"\"),this.dither.match(/-serpentine/)!==null)}else{this.indexPixels()}this.pixels=null;this.colorDepth=8;this.palSize=7;if(this.transparent!==null){this.transIndex=this.findClosest(this.transparent,true)}};GIFEncoder.prototype.indexPixels=function(imgq){var nPix=this.pixels.length/3;this.indexedPixels=new Uint8Array(nPix);var k=0;for(var j=0;j<nPix;j++){var index=this.findClosestRGB(this.pixels[k++]&255,this.pixels[k++]&255,this.pixels[k++]&255);this.usedEntry[index]=true;this.indexedPixels[j]=index}};GIFEncoder.prototype.ditherPixels=function(kernel,serpentine){var kernels={FalseFloydSteinberg:[[3/8,1,0],[3/8,0,1],[2/8,1,1]],FloydSteinberg:[[7/16,1,0],[3/16,-1,1],[5/16,0,1],[1/16,1,1]],Stucki:[[8/42,1,0],[4/42,2,0],[2/42,-2,1],[4/42,-1,1],[8/42,0,1],[4/42,1,1],[2/42,2,1],[1/42,-2,2],[2/42,-1,2],[4/42,0,2],[2/42,1,2],[1/42,2,2]],Atkinson:[[1/8,1,0],[1/8,2,0],[1/8,-1,1],[1/8,0,1],[1/8,1,1],[1/8,0,2]]};if(!kernel||!kernels[kernel]){throw\"Unknown dithering kernel: \"+kernel}var ds=kernels[kernel];var index=0,height=this.height,width=this.width,data=this.pixels;var direction=serpentine?-1:1;this.indexedPixels=new Uint8Array(this.pixels.length/3);for(var y=0;y<height;y++){if(serpentine)direction=direction*-1;for(var x=direction==1?0:width-1,xend=direction==1?width:0;x!==xend;x+=direction){index=y*width+x;var idx=index*3;var r1=data[idx];var g1=data[idx+1];var b1=data[idx+2];idx=this.findClosestRGB(r1,g1,b1);this.usedEntry[idx]=true;this.indexedPixels[index]=idx;idx*=3;var r2=this.colorTab[idx];var g2=this.colorTab[idx+1];var b2=this.colorTab[idx+2];var er=r1-r2;var eg=g1-g2;var eb=b1-b2;for(var i=direction==1?0:ds.length-1,end=direction==1?ds.length:0;i!==end;i+=direction){var x1=ds[i][1];var y1=ds[i][2];if(x1+x>=0&&x1+x<width&&y1+y>=0&&y1+y<height){var d=ds[i][0];idx=index+x1+y1*width;idx*=3;data[idx]=Math.max(0,Math.min(255,data[idx]+er*d));data[idx+1]=Math.max(0,Math.min(255,data[idx+1]+eg*d));data[idx+2]=Math.max(0,Math.min(255,data[idx+2]+eb*d))}}}}};GIFEncoder.prototype.findClosest=function(c,used){return this.findClosestRGB((c&16711680)>>16,(c&65280)>>8,c&255,used)};GIFEncoder.prototype.findClosestRGB=function(r,g,b,used){if(this.colorTab===null)return-1;if(this.neuQuant&&!used){return this.neuQuant.lookupRGB(r,g,b)}var c=b|g<<8|r<<16;var minpos=0;var dmin=256*256*256;var len=this.colorTab.length;for(var i=0,index=0;i<len;index++){var dr=r-(this.colorTab[i++]&255);var dg=g-(this.colorTab[i++]&255);var db=b-(this.colorTab[i++]&255);var d=dr*dr+dg*dg+db*db;if((!used||this.usedEntry[index])&&d<dmin){dmin=d;minpos=index}}return minpos};GIFEncoder.prototype.getImagePixels=function(){var w=this.width;var h=this.height;this.pixels=new Uint8Array(w*h*3);var data=this.image;var srcPos=0;var count=0;for(var i=0;i<h;i++){for(var j=0;j<w;j++){this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];srcPos++}}};GIFEncoder.prototype.writeGraphicCtrlExt=function(){this.out.writeByte(33);this.out.writeByte(249);this.out.writeByte(4);var transp,disp;if(this.transparent===null){transp=0;disp=0}else{transp=1;disp=2}if(this.dispose>=0){disp=dispose&7}disp<<=2;this.out.writeByte(0|disp|0|transp);this.writeShort(this.delay);this.out.writeByte(this.transIndex);this.out.writeByte(0)};GIFEncoder.prototype.writeImageDesc=function(){this.out.writeByte(44);this.writeShort(0);this.writeShort(0);this.writeShort(this.width);this.writeShort(this.height);if(this.firstFrame||this.globalPalette){this.out.writeByte(0)}else{this.out.writeByte(128|0|0|0|this.palSize)}};GIFEncoder.prototype.writeLSD=function(){this.writeShort(this.width);this.writeShort(this.height);this.out.writeByte(128|112|0|this.palSize);this.out.writeByte(0);this.out.writeByte(0)};GIFEncoder.prototype.writeNetscapeExt=function(){this.out.writeByte(33);this.out.writeByte(255);this.out.writeByte(11);this.out.writeUTFBytes(\"NETSCAPE2.0\");this.out.writeByte(3);this.out.writeByte(1);this.writeShort(this.repeat);this.out.writeByte(0)};GIFEncoder.prototype.writePalette=function(){this.out.writeBytes(this.colorTab);var n=3*256-this.colorTab.length;for(var i=0;i<n;i++)this.out.writeByte(0)};GIFEncoder.prototype.writeShort=function(pValue){this.out.writeByte(pValue&255);this.out.writeByte(pValue>>8&255)};GIFEncoder.prototype.writePixels=function(){var enc=new LZWEncoder(this.width,this.height,this.indexedPixels,this.colorDepth);enc.encode(this.out)};GIFEncoder.prototype.stream=function(){return this.out};module.exports=GIFEncoder},{\"./LZWEncoder.js\":2,\"./TypedNeuQuant.js\":3}],2:[function(require,module,exports){var EOF=-1;var BITS=12;var HSIZE=5003;var masks=[0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535];function LZWEncoder(width,height,pixels,colorDepth){var initCodeSize=Math.max(2,colorDepth);var accum=new Uint8Array(256);var htab=new Int32Array(HSIZE);var codetab=new Int32Array(HSIZE);var cur_accum,cur_bits=0;var a_count;var free_ent=0;var maxcode;var clear_flg=false;var g_init_bits,ClearCode,EOFCode;function char_out(c,outs){accum[a_count++]=c;if(a_count>=254)flush_char(outs)}function cl_block(outs){cl_hash(HSIZE);free_ent=ClearCode+2;clear_flg=true;output(ClearCode,outs)}function cl_hash(hsize){for(var i=0;i<hsize;++i)htab[i]=-1}function compress(init_bits,outs){var fcode,c,i,ent,disp,hsize_reg,hshift;g_init_bits=init_bits;clear_flg=false;n_bits=g_init_bits;maxcode=MAXCODE(n_bits);ClearCode=1<<init_bits-1;EOFCode=ClearCode+1;free_ent=ClearCode+2;a_count=0;ent=nextPixel();hshift=0;for(fcode=HSIZE;fcode<65536;fcode*=2)++hshift;hshift=8-hshift;hsize_reg=HSIZE;cl_hash(hsize_reg);output(ClearCode,outs);outer_loop:while((c=nextPixel())!=EOF){fcode=(c<<BITS)+ent;i=c<<hshift^ent;if(htab[i]===fcode){ent=codetab[i];continue}else if(htab[i]>=0){disp=hsize_reg-i;if(i===0)disp=1;do{if((i-=disp)<0)i+=hsize_reg;if(htab[i]===fcode){ent=codetab[i];continue outer_loop}}while(htab[i]>=0)}output(ent,outs);ent=c;if(free_ent<1<<BITS){codetab[i]=free_ent++;htab[i]=fcode}else{cl_block(outs)}}output(ent,outs);output(EOFCode,outs)}function encode(outs){outs.writeByte(initCodeSize);remaining=width*height;curPixel=0;compress(initCodeSize+1,outs);outs.writeByte(0)}function flush_char(outs){if(a_count>0){outs.writeByte(a_count);outs.writeBytes(accum,0,a_count);a_count=0}}function MAXCODE(n_bits){return(1<<n_bits)-1}function nextPixel(){if(remaining===0)return EOF;--remaining;var pix=pixels[curPixel++];return pix&255}function output(code,outs){cur_accum&=masks[cur_bits];if(cur_bits>0)cur_accum|=code<<cur_bits;else cur_accum=code;cur_bits+=n_bits;while(cur_bits>=8){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8}if(free_ent>maxcode||clear_flg){if(clear_flg){maxcode=MAXCODE(n_bits=g_init_bits);clear_flg=false}else{++n_bits;if(n_bits==BITS)maxcode=1<<BITS;else maxcode=MAXCODE(n_bits)}}if(code==EOFCode){while(cur_bits>0){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8}flush_char(outs)}}this.encode=encode}module.exports=LZWEncoder},{}],3:[function(require,module,exports){var ncycles=100;var netsize=256;var maxnetpos=netsize-1;var netbiasshift=4;var intbiasshift=16;var intbias=1<<intbiasshift;var gammashift=10;var gamma=1<<gammashift;var betashift=10;var beta=intbias>>betashift;var betagamma=intbias<<gammashift-betashift;var initrad=netsize>>3;var radiusbiasshift=6;var radiusbias=1<<radiusbiasshift;var initradius=initrad*radiusbias;var radiusdec=30;var alphabiasshift=10;var initalpha=1<<alphabiasshift;var alphadec;var radbiasshift=8;var radbias=1<<radbiasshift;var alpharadbshift=alphabiasshift+radbiasshift;var alpharadbias=1<<alpharadbshift;var prime1=499;var prime2=491;var prime3=487;var prime4=503;var minpicturebytes=3*prime4;function NeuQuant(pixels,samplefac){var network;var netindex;var bias;var freq;var radpower;function init(){network=[];netindex=new Int32Array(256);bias=new Int32Array(netsize);freq=new Int32Array(netsize);radpower=new Int32Array(netsize>>3);var i,v;for(i=0;i<netsize;i++){v=(i<<netbiasshift+8)/netsize;network[i]=new Float64Array([v,v,v,0]);freq[i]=intbias/netsize;bias[i]=0}}function unbiasnet(){for(var i=0;i<netsize;i++){network[i][0]>>=netbiasshift;network[i][1]>>=netbiasshift;network[i][2]>>=netbiasshift;network[i][3]=i}}function altersingle(alpha,i,b,g,r){network[i][0]-=alpha*(network[i][0]-b)/initalpha;network[i][1]-=alpha*(network[i][1]-g)/initalpha;network[i][2]-=alpha*(network[i][2]-r)/initalpha}function alterneigh(radius,i,b,g,r){var lo=Math.abs(i-radius);var hi=Math.min(i+radius,netsize);var j=i+1;var k=i-1;var m=1;var p,a;while(j<hi||k>lo){a=radpower[m++];if(j<hi){p=network[j++];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias}if(k>lo){p=network[k--];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias}}}function contest(b,g,r){var bestd=~(1<<31);var bestbiasd=bestd;var bestpos=-1;var bestbiaspos=bestpos;var i,n,dist,biasdist,betafreq;for(i=0;i<netsize;i++){n=network[i];dist=Math.abs(n[0]-b)+Math.abs(n[1]-g)+Math.abs(n[2]-r);if(dist<bestd){bestd=dist;bestpos=i}biasdist=dist-(bias[i]>>intbiasshift-netbiasshift);if(biasdist<bestbiasd){bestbiasd=biasdist;bestbiaspos=i}betafreq=freq[i]>>betashift;freq[i]-=betafreq;bias[i]+=betafreq<<gammashift}freq[bestpos]+=beta;bias[bestpos]-=betagamma;return bestbiaspos}function inxbuild(){var i,j,p,q,smallpos,smallval,previouscol=0,startpos=0;for(i=0;i<netsize;i++){p=network[i];smallpos=i;smallval=p[1];for(j=i+1;j<netsize;j++){q=network[j];if(q[1]<smallval){smallpos=j;smallval=q[1]}}q=network[smallpos];if(i!=smallpos){j=q[0];q[0]=p[0];p[0]=j;j=q[1];q[1]=p[1];p[1]=j;j=q[2];q[2]=p[2];p[2]=j;j=q[3];q[3]=p[3];p[3]=j}if(smallval!=previouscol){netindex[previouscol]=startpos+i>>1;for(j=previouscol+1;j<smallval;j++)netindex[j]=i;previouscol=smallval;startpos=i}}netindex[previouscol]=startpos+maxnetpos>>1;for(j=previouscol+1;j<256;j++)netindex[j]=maxnetpos}function inxsearch(b,g,r){var a,p,dist;var bestd=1e3;var best=-1;var i=netindex[g];var j=i-1;while(i<netsize||j>=0){if(i<netsize){p=network[i];dist=p[1]-g;if(dist>=bestd)i=netsize;else{i++;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3]}}}}if(j>=0){p=network[j];dist=g-p[1];if(dist>=bestd)j=-1;else{j--;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3]}}}}}return best}function learn(){var i;var lengthcount=pixels.length;var alphadec=30+(samplefac-1)/3;var samplepixels=lengthcount/(3*samplefac);var delta=~~(samplepixels/ncycles);var alpha=initalpha;var radius=initradius;var rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(i=0;i<rad;i++)radpower[i]=alpha*((rad*rad-i*i)*radbias/(rad*rad));var step;if(lengthcount<minpicturebytes){samplefac=1;step=3}else if(lengthcount%prime1!==0){step=3*prime1}else if(lengthcount%prime2!==0){step=3*prime2}else if(lengthcount%prime3!==0){step=3*prime3}else{step=3*prime4}var b,g,r,j;var pix=0;i=0;while(i<samplepixels){b=(pixels[pix]&255)<<netbiasshift;g=(pixels[pix+1]&255)<<netbiasshift;r=(pixels[pix+2]&255)<<netbiasshift;j=contest(b,g,r);altersingle(alpha,j,b,g,r);if(rad!==0)alterneigh(rad,j,b,g,r);pix+=step;if(pix>=lengthcount)pix-=lengthcount;i++;if(delta===0)delta=1;if(i%delta===0){alpha-=alpha/alphadec;radius-=radius/radiusdec;rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(j=0;j<rad;j++)radpower[j]=alpha*((rad*rad-j*j)*radbias/(rad*rad))}}}function buildColormap(){init();learn();unbiasnet();inxbuild()}this.buildColormap=buildColormap;function getColormap(){var map=[];var index=[];for(var i=0;i<netsize;i++)index[network[i][3]]=i;var k=0;for(var l=0;l<netsize;l++){var j=index[l];map[k++]=network[j][0];map[k++]=network[j][1];map[k++]=network[j][2]}return map}this.getColormap=getColormap;this.lookupRGB=inxsearch}module.exports=NeuQuant},{}],4:[function(require,module,exports){var GIFEncoder,renderFrame;GIFEncoder=require(\"./GIFEncoder.js\");renderFrame=function(frame){var encoder,page,stream,transfer;encoder=new GIFEncoder(frame.width,frame.height);if(frame.index===0){encoder.writeHeader()}else{encoder.firstFrame=false}encoder.setTransparent(frame.transparent);encoder.setRepeat(frame.repeat);encoder.setDelay(frame.delay);encoder.setQuality(frame.quality);encoder.setDither(frame.dither);encoder.setGlobalPalette(frame.globalPalette);encoder.addFrame(frame.data);if(frame.last){encoder.finish()}if(frame.globalPalette===true){frame.globalPalette=encoder.getGlobalPalette()}stream=encoder.stream();frame.data=stream.pages;frame.cursor=stream.cursor;frame.pageSize=stream.constructor.pageSize;if(frame.canTransfer){transfer=function(){var i,len,ref,results;ref=frame.data;results=[];for(i=0,len=ref.length;i<len;i++){page=ref[i];results.push(page.buffer)}return results}();return self.postMessage(frame,transfer)}else{return self.postMessage(frame)}};self.onmessage=function(event){return renderFrame(event.data)}},{\"./GIFEncoder.js\":1}]},{},[4]);\n//# sourceMappingURL=gif.worker.js.map\n";

// ── Dry-Run GIF Generation ─────────────────
// State
const GIF_FRAME_MS  = Math.round(1000 / 15);  // 15fps Capture-Rate
const GIF_W         = 530;
const GIF_H         = 350;
const GIF_MAX_PLAY_SEC = 4.0;   // maximale Play-Phase-Dauer in Sim-Sekunden
const GIF_MAX_REAL_MS  = 12000; // Failsafe: max Wartezeit in Echtzeitms

let _dryGif         = null;
let _dryRunning     = false;
let _dryRafId       = null;
let _dryLastFrameTs = 0;
let _dryStartTs     = 0;
let _drySavedSpeed  = 2;

// Offscreen-Canvas für Vollbild-Rendering
const _dryRenderCanvas    = document.createElement('canvas');
_dryRenderCanvas.width    = FIELD_W;  // 1060
_dryRenderCanvas.height   = FIELD_H;  // 700

// Scale-Canvas für GIF-Frames (halbe Auflösung)
const _dryScaleCanvas     = document.createElement('canvas');
_dryScaleCanvas.width     = GIF_W;
_dryScaleCanvas.height    = GIF_H;
const _dryScaleCtx        = _dryScaleCanvas.getContext('2d');

// ── Shared: Build play data object for embedding ─────────────
function _buildPlayData(nameRaw) {
  return {
    name: nameRaw,
    ball: { x: ball.x, y: ball.y },
    motionOwnerId,
    olineBlocks: Object.fromEntries(
      OLINE_IDS.map(id => [id, {
        blockPoints: olineData[id].blockPoints,
        important:   olineData[id].important,
      }])
    ),
    players: players.map(p => ({
      id: p.id, type: p.type, label: p.label,
      x: p.x, y: p.y, origX: p.origX, origY: p.origY,
      important:    p.important,
      routePoints:  p.routePoints,
      motionPoints: p.motionPoints,
      shiftPoints:  p.shiftPoints,
      blockPoints:  p.blockPoints,
      routes:       p.routePoints,
    })),
    defensePlayers: defensePlayers.map(d => ({
      id: d.id, role: d.role, x: d.x, y: d.y,
      origX: d.origX, origY: d.origY,
      assignment: { ...d.assignment },
      speedMultiplier: d.speedMultiplier,
      cbSpacing: d.cbSpacing || 'normal',
      cbShade:   d.cbShade   || 'normal',
      mirroredWRId: d.mirroredWRId ?? null,
    })),
    nextDefId,
  };
}

// ── Einstiegspunkt: SAVE GIF Button ────────
function generateAndSavePlayGif() {
  if (typeof mode !== 'undefined' && mode !== 'editor') {
    showToast('⚠ Nur im Editor-Modus speicherbar', 'info');
    return;
  }

  // Overlay anzeigen
  const overlay = document.getElementById('gifGenOverlay');
  const msg     = document.getElementById('gifGenMsg');
  if (overlay) { overlay.style.display = 'flex'; }
  if (msg)     { msg.textContent = '⏳ Play wird simuliert…'; }

  // GIF-Instanz erstellen
  const workerUrl = URL.createObjectURL(
    new Blob([_GIF_WORKER_SRC], { type: 'text/javascript' })
  );
  _dryGif = new GIF({
    workers: 2,
    quality: 8,
    width:   GIF_W,
    height:  GIF_H,
    workerScript: workerUrl,
    repeat: 0,
  });

  // ctx auf Offscreen-Canvas umleiten
  _drySavedSpeed = (typeof simSpeed !== 'undefined') ? simSpeed : 2;
  if (typeof simSpeed !== 'undefined') simSpeed = 2;
  ctx = _dryRenderCanvas.getContext('2d');

  // Simulation starten (zeichnet jetzt auf Offscreen)
  if (typeof startSim === 'function') startSim();

  // Capture-Loop starten
  _dryRunning     = true;
  _dryLastFrameTs = performance.now();
  _dryStartTs     = performance.now();
  requestAnimationFrame(_dryLoop);
}

function _dryLoop(ts) {
  if (!_dryRunning) return;

  const realElapsed = ts - _dryStartTs;
  const elapsed     = ts - _dryLastFrameTs;

  // Frame erfassen (15fps)
  if (elapsed >= GIF_FRAME_MS) {
    _dryScaleCtx.drawImage(_dryRenderCanvas, 0, 0, GIF_W, GIF_H);
    _dryGif.addFrame(_dryScaleCanvas, { copy: true, delay: Math.round(elapsed) });
    _dryLastFrameTs = ts;
  }

  // Stop-Bedingungen: immer volle 4 Sim-Sekunden Play, egal ob QB wirft oder nicht
  const playDone = (typeof playPhaseTime !== 'undefined' && playPhaseTime >= GIF_MAX_PLAY_SEC);
  const timedOut = realElapsed >= GIF_MAX_REAL_MS;

  if (playDone || timedOut) {
    _dryFinalize();
    return;
  }

  _dryRafId = requestAnimationFrame(_dryLoop);
}

function _dryFinalize() {
  _dryRunning = false;
  if (_dryRafId) { cancelAnimationFrame(_dryRafId); _dryRafId = null; }

  // ctx ZUERST zurück auf sichtbaren Canvas (stopSim ruft draw() intern auf!)
  ctx = canvas.getContext('2d');
  if (typeof simSpeed !== 'undefined') simSpeed = _drySavedSpeed;

  // Outcome-Overlay verbergen falls vorhanden
  const outcomeOverlay = document.getElementById('outcomeOverlay');
  if (outcomeOverlay) outcomeOverlay.classList.remove('visible');

  // Sim stoppen → stellt Spielerpositionen wieder her + ruft draw() auf
  if (typeof stopSim === 'function') stopSim();

  // Play-Name lesen
  const _playNameRaw  = (document.getElementById('playNameInput')?.value || '').trim();
  const _playName     = _playNameRaw || 'play';
  const _safeFilename = _playName.replace(/[\\/:*?"<>|]/g, '_') + '.gif';

  // JSON aufbauen (aktuelle Editor-Positionen, nicht Sim-Positionen)
  const jsonStr = JSON.stringify(_buildPlayData(_playNameRaw));

  // Overlay-Text aktualisieren
  const msg = document.getElementById('gifGenMsg');
  if (msg) msg.textContent = '⏳ GIF wird kodiert…';

  const gifInst = _dryGif;
  _dryGif = null;

  gifInst.on('finished', blob => {
    blob.arrayBuffer().then(buf => {
      const patched = _embedJsonInGif(buf, jsonStr);
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(new Blob([patched], { type: 'image/gif' }));
      a.download = _safeFilename;
      a.click();

      // Overlay ausblenden
      const overlay = document.getElementById('gifGenOverlay');
      if (overlay) overlay.style.display = 'none';

      showToast(`✓ ${_safeFilename} gespeichert`, 'info');
    });
  });

  gifInst.render();
}

// ── JSON in GIF-Comment-Extension einbetten ─
function _embedJsonInGif(arrayBuf, jsonStr) {
  const src  = new Uint8Array(arrayBuf);
  const body = src.slice(0, src.length - 1); // letztes Byte = Trailer 0x3B entfernen

  const jsonBytes = new TextEncoder().encode(jsonStr);
  const chunks = [];
  for (let i = 0; i < jsonBytes.length; i += 255) {
    chunks.push(jsonBytes.slice(i, i + 255));
  }

  // Größe des Comment-Blocks berechnen
  let commentSize = 2; // 0x21 0xFE
  for (const c of chunks) commentSize += 1 + c.length;
  commentSize += 1; // Terminator 0x00

  const result = new Uint8Array(body.length + commentSize + 1);
  result.set(body, 0);
  let pos = body.length;
  result[pos++] = 0x21;
  result[pos++] = 0xFE;
  for (const c of chunks) {
    result[pos++] = c.length;
    result.set(c, pos);
    pos += c.length;
  }
  result[pos++] = 0x00;  // Sub-Block-Terminator
  result[pos]   = 0x3B;  // GIF-Trailer
  return result;
}

// ── PNG Export + JSON nach IEND einbetten ──────────────────────────────────
const _PNG_MARKER = 'KARDIRON_PLAY:';  // marker before JSON in appended data

function savePlayAsPng() {
  if (mode !== 'editor') { showToast('⚠ Only saveable in editor mode', 'info'); return; }

  // Build play JSON (same fields as GIF export)
  const nameRaw      = (document.getElementById('playNameInput')?.value || '').trim();
  const playName     = nameRaw || 'play';
  const safeFilename = playName.replace(/[\\/:*?"<>|]/g, '_') + '.png';

  const jsonStr = _PNG_MARKER + JSON.stringify(_buildPlayData(nameRaw));

  canvas.toBlob(blob => {
    blob.arrayBuffer().then(buf => {
      // Append JSON after PNG IEND chunk
      const marker   = new TextEncoder().encode(jsonStr);
      const combined = new Uint8Array(buf.byteLength + marker.length);
      combined.set(new Uint8Array(buf), 0);
      combined.set(marker, buf.byteLength);

      const a = document.createElement('a');
      a.href     = URL.createObjectURL(new Blob([combined], { type: 'image/png' }));
      a.download = safeFilename;
      a.click();
      showToast(`✓ ${safeFilename} gespeichert`, 'info');
    });
  }, 'image/png');
}

// ── JSON aus PNG lesen ─────────────────────────────────────────────────────
function loadFromPng(arrayBuf) {
  const bytes = new Uint8Array(arrayBuf);
  const enc   = new TextEncoder().encode(_PNG_MARKER);
  // Scan from end for efficiency (marker is appended at the very end)
  outer:
  for (let i = bytes.length - enc.length; i >= 0; i--) {
    for (let j = 0; j < enc.length; j++) {
      if (bytes[i + j] !== enc[j]) continue outer;
    }
    // Found marker at position i
    const jsonBytes = bytes.slice(i + enc.length);
    try { return JSON.parse(new TextDecoder().decode(jsonBytes)); } catch(e) {}
  }
  return null;
}

// ── MP4 / WebM Export via MediaRecorder ────────────────────────────────────
// Verwendet denselben Trailer-Marker wie PNG. WhatsApp re-encoded Videos beim
// Senden → eingebettetes JSON überlebt nur "lokal teilen", nicht den
// WhatsApp-Roundtrip. Inline-Animation in WhatsApp funktioniert aber direkt.

let _mp4Recorder = null;
let _mp4Chunks   = [];
let _mp4Mime     = '';
let _mp4Ext      = 'mp4';

function _pickVideoMime() {
  const candidates = [
    { mime: 'video/mp4;codecs=h264',    ext: 'mp4'  },
    { mime: 'video/mp4;codecs=avc1',    ext: 'mp4'  },
    { mime: 'video/mp4',                ext: 'mp4'  },
    { mime: 'video/webm;codecs=vp9',    ext: 'webm' },
    { mime: 'video/webm;codecs=vp8',    ext: 'webm' },
    { mime: 'video/webm',               ext: 'webm' },
  ];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c.mime)) return c; } catch(e) {}
  }
  return null;
}

function generateAndSavePlayMp4() {
  if (typeof mode !== 'undefined' && mode !== 'editor') {
    showToast('⚠ Nur im Editor-Modus speicherbar', 'info');
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    showToast('⚠ Browser unterstützt kein Video-Recording', 'info');
    return;
  }
  const picked = _pickVideoMime();
  if (!picked) {
    showToast('⚠ Browser unterstützt kein Video-Recording', 'info');
    return;
  }
  _mp4Mime = picked.mime;
  _mp4Ext  = picked.ext;

  // Overlay
  const overlay = document.getElementById('gifGenOverlay');
  const msg     = document.getElementById('gifGenMsg');
  if (overlay) overlay.style.display = 'flex';
  if (msg)     msg.textContent = '⏳ Play wird simuliert…';

  // ctx auf Offscreen-Canvas umleiten
  _drySavedSpeed = (typeof simSpeed !== 'undefined') ? simSpeed : 2;
  if (typeof simSpeed !== 'undefined') simSpeed = 2;
  ctx = _dryRenderCanvas.getContext('2d');

  // MediaRecorder auf Offscreen-Canvas
  const stream = _dryRenderCanvas.captureStream(30);
  try {
    _mp4Recorder = new MediaRecorder(stream, {
      mimeType: _mp4Mime,
      videoBitsPerSecond: 2_500_000,
    });
  } catch (e) {
    // Fallback: ohne expliziten mimeType
    _mp4Recorder = new MediaRecorder(stream);
    _mp4Mime = _mp4Recorder.mimeType || _mp4Mime;
    if (_mp4Mime.includes('webm')) _mp4Ext = 'webm';
  }
  _mp4Chunks = [];
  _mp4Recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) _mp4Chunks.push(e.data);
  };
  _mp4Recorder.onstop = () => {
    new Blob(_mp4Chunks, { type: _mp4Mime })
      .arrayBuffer()
      .then(buf => _mp4Finalize(buf));
  };

  if (typeof startSim === 'function') startSim();
  _mp4Recorder.start();

  _dryRunning = true;
  _dryStartTs = performance.now();
  _dryRafId   = requestAnimationFrame(_mp4WatchLoop);
}

function _mp4WatchLoop(ts) {
  if (!_dryRunning) return;
  const realElapsed = ts - _dryStartTs;
  const playDone = (typeof playPhaseTime !== 'undefined' && playPhaseTime >= GIF_MAX_PLAY_SEC);
  const timedOut = realElapsed >= GIF_MAX_REAL_MS;

  if (playDone || timedOut) {
    _dryRunning = false;
    if (_dryRafId) { cancelAnimationFrame(_dryRafId); _dryRafId = null; }
    if (_mp4Recorder && _mp4Recorder.state === 'recording') {
      _mp4Recorder.stop();
    }
    return;
  }
  _dryRafId = requestAnimationFrame(_mp4WatchLoop);
}

function _mp4Finalize(arrayBuf) {
  // ctx ZUERST zurück auf sichtbaren Canvas (stopSim ruft draw() intern auf)
  ctx = canvas.getContext('2d');
  if (typeof simSpeed !== 'undefined') simSpeed = _drySavedSpeed;

  const outcomeOverlay = document.getElementById('outcomeOverlay');
  if (outcomeOverlay) outcomeOverlay.classList.remove('visible');
  if (typeof stopSim === 'function') stopSim();

  // Play-Name + Filename
  const nameRaw      = (document.getElementById('playNameInput')?.value || '').trim();
  const playName     = nameRaw || 'play';
  const safeFilename = playName.replace(/[\\/:*?"<>|]/g, '_') + '.' + _mp4Ext;

  // JSON ans Datei-Ende anhängen (gleiche Mechanik wie PNG)
  const jsonStr  = _PNG_MARKER + JSON.stringify(_buildPlayData(nameRaw));
  const marker   = new TextEncoder().encode(jsonStr);
  const combined = new Uint8Array(arrayBuf.byteLength + marker.length);
  combined.set(new Uint8Array(arrayBuf), 0);
  combined.set(marker, arrayBuf.byteLength);

  const blobType = _mp4Ext === 'mp4' ? 'video/mp4' : 'video/webm';
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([combined], { type: blobType }));
  a.download = safeFilename;
  a.click();

  const overlay = document.getElementById('gifGenOverlay');
  if (overlay) overlay.style.display = 'none';
  showToast(`✓ ${safeFilename} gespeichert`, 'info');

  _mp4Recorder = null;
  _mp4Chunks   = [];
}

// JSON aus MP4/WebM lesen — identisch zu PNG (Trailer-Marker)
function loadFromVideo(arrayBuf) {
  return loadFromPng(arrayBuf);
}

// ── JSON aus GIF-Comment-Extension lesen ───
function loadFromGif(arrayBuf) {
  const bytes = new Uint8Array(arrayBuf);
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] !== 0x21 || bytes[i + 1] !== 0xFE) continue;
    let pos = i + 2;
    const dec = new TextDecoder();
    let text = '';
    while (pos < bytes.length) {
      const len = bytes[pos++];
      if (len === 0) break;
      text += dec.decode(bytes.slice(pos, pos + len));
      pos += len;
    }
    try { return JSON.parse(text); } catch(e) {}
  }
  return null;
}
