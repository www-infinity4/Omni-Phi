const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('a selected visual survives deduplication against its own collected source',()=>{
 const token='original-token',url='https://example.test/gems',data=new Map(Object.entries({
  'phiShared:collection:v1':[{tokenId:token,title:'Gem evidence',url,extract:'Source explanation'}],
  'omniPhi:websiteDirection:v1':{tokenId:token,query:'ShopLC',overview:'Chosen education direction',selectedImages:[{title:'Selected gemstone',sourceUrl:url,imageUrl:'https://example.test/gem.jpg',sourceExtract:'Image source explanation'}]}
 }).map(([k,v])=>[k,JSON.stringify(v)]));
 const storage={getItem:k=>data.get(k)||null},window={fetch:async()=>({})};
 vm.runInNewContext(fs.readFileSync(__dirname+'/token-context.js','utf8'),{window,localStorage:storage,sessionStorage:{getItem:()=>null},location:{search:'?q=ShopLC&token='+token,href:'https://example.test/code/'},URL,URLSearchParams});
 const context=window.InfinityTokenContext.load('ShopLC',token);assert.equal(context.counts.images,1);assert.equal(context.images[0].image,'https://example.test/gem.jpg');assert.equal(context.overview,'Chosen education direction');assert.equal(context.tokenId,token);
});
