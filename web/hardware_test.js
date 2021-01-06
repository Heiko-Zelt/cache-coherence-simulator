// only one global variable:
let computerSystem = null

const protocolsText = ['nicht vergeben', 'no cache', 'VI', 'MSI', 'MESI', 'MOSI', 'MOESI']

function logOperation(msg) {
  console.log(msg)
  $("#testResults").append(msg + '<br>\n')
}

function write(cpuNum, adr, val) {
  computerSystem.cpus[cpuNum].store(adr, val)
  logOperation('write cpuNum=' + cpuNum + ', adr=' + adr + ', value=' + val)
  dump()
}

function readAssert(cpuNum, adr, expected) {
  let val = computerSystem.cpus[cpuNum].load(adr)
  let ok = (val == expected)
  let testResult = null
  if(ok) {
	testResult = "ok"
  } else {
	testResult = "!!! E R R O R !!!"
  }
  logOperation('read cpuNum=' + cpuNum + ', adr=' + adr + ', expected=' + expected + ', value=' + val + ', test result=' + testResult)
  dump()
}

function dump() {
  let b = computerSystem.bus
  if(b.caches != null) {
    for(let i = 0; i < b.caches.length; i++) {
	  b.caches[i].dump()
	}
  }
}

$(function() {
  let numberOfCpus = 3
  let offsetBits = 2
  let numberOfCacheLines = 3
  let numberOfMemoryLines = 12
  let memorySize = numberOfMemoryLines * (1 << offsetBits)	
	
  let protocols = [
    CacheProtocols.NO_CACHE,
    CacheProtocols.VI,
	CacheProtocols.MSI,
	CacheProtocols.MESI,
	CacheProtocols.MOSI,
 	CacheProtocols.MOESI
  ]
  protocols.forEach(function(protocol) {
	console.log('protocol=' + protocol)
	if(protocol == CacheProtocols.NO_CACHE) {
	  console.log('DEBUG no Caches')
      computerSystem = new SystemNoCaches(memorySize, numberOfCpus)
	} else {
	  console.log('DEBUG new Caches')
	  computerSystem = new SystemWithCaches(memorySize, numberOfCpus, protocol, numberOfCacheLines, offsetBits)
    }  

    logOperation(' ')
    logOperation(' = ' + protocolsText[protocol] + ' = ')
	readAssert(1, 24, 0)
	write(1, 24, '.')
    readAssert(0, 0, 0)
    write(0, 0, 'a')
    readAssert(0, 0, 'a')
	write(0, 0, 'b')
	readAssert(0, 0, 'b')
	write(1, 0, 'c')
	readAssert(2, 0, 'c')
	write(2, 1 , 'd')
	write(2, 2 , 'e')
	write(2, 10 , 'f')
	write(2, 16 , 'g')
	readAssert(2, 0, 'c')
	readAssert(2, 2, 'e')
	readAssert(2, 10, 'f')
	readAssert(2, 16, 'g')
	readAssert(1, 16, 'g')
	readAssert(1, 10, 'f')
	readAssert(0, 0, 'c')
	readAssert(1, 0, 'c')
	write(1, 8, 'h')
	write(2, 9, 'i')
	readAssert(2, 8, 'h')
	readAssert(0, 8, 'h')
	readAssert(1, 9, 'i')
	readAssert(1, 0, 'c')
	readAssert(1, 10, 'f')
	readAssert(1, 16, 'g')
	readAssert(1, 2, 'e')
	write(1, 0, 'j')
	write(1, 4, 'k')
	write(1, 8, 'L')
	write(1, 12, 'm')
	write(1, 16, 'n')
	write(1, 20, 'o')
	readAssert(1, 0, 'j')
	readAssert(1, 4, 'k')
	readAssert(2, 4, 'k')
	readAssert(0, 0, 'j')
	readAssert(1, 8, 'L')
	write(1, 8, 'p')
	readAssert(1, 8, 'p')
	readAssert(2, 8, 'p')
	write(2, 8, 'q')
	readAssert(2, 8, 'q')
	
	let b = computerSystem.bus
	logOperation('bus counterLoad=' + b.counterLoad)
	logOperation('bus counterStore=' + b.counterStore)
	logOperation('bus counterReadMiss=' + b.counterReadMiss)
	logOperation('bus counterWriteMiss=' + b.counterWriteMiss)
	logOperation('bus counterWriteBack=' + b.counterWriteBack)
	logOperation('bus counterInvalidate=' + b.counterInvalidate)
	logOperation('bus counterMemoryResponse=' + b.counterMemoryResponse)
	logOperation('bus counterCacheResponse=' + b.counterCacheResponse)
	logOperation('bus counterMemory=' + b.getCounterMemory())
	logOperation('bus counterTotal=' + b.getCounterTotal())
	logOperation('time=' + b.clock.time)
  })
})