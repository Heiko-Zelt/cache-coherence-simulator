// global variables:
let computerSystem = null
let clockUI = null
let memoryUI = null
let cacheUIs = null
let cpuUIs = null
let systemUI = null
let adrNumberSystemBase = 10

function str2adr(str, base) {
  return parseInt(str, this.adrNumberSystemBase)
}

class ClockView {
  constructor(clock) {
	this.clock = clock;
  }

  // event handler is called by constructor, inc() and reset() of clock
  clockTicked() {
	//console.log("DEBUG time=" + this.clock.time)
	$('#time').html(this.clock.time)
  }
  
}

class MemoryView {
  lineNum2String(lineNum) {
	let standardLength = (this.memory.data.length / this.valuesPerLine - 1).toString(this.adrNumberSystemBase).length
	let str = lineNum.toString(this.adrNumberSystemBase)
	return '0'.repeat(standardLength - str.length) + str
  }
  
  columnNum2String(colNum) {
	let standardLength = (this.valuesPerLine - 1).toString(this.adrNumberSystemBase).length
	let str = colNum.toString(this.adrNumberSystemBase)
	return '0'.repeat(standardLength - str.length) + str
  }
	
  constructor(mem, valuesPerLine, adrNumberSystemBase) {
	this.memory = mem
	this.valuesPerLine = valuesPerLine
	this.adrNumberSystemBase = adrNumberSystemBase
	this.numberOfRows = mem.data.length / valuesPerLine
  }
  
  changeAdrNumberSystem(adrNumberSystemBase) {
	let numberOfBlocks = 4
	let rowsPerBlock = this.numberOfRows / 4	  
	  
	this.adrNumberSystemBase = adrNumberSystemBase
	console.log('DEBUG MemoryView.changeAdrNumberSystem(' + adrNumberSystemBase + ')')
	
	for(let blockNum = 0; blockNum < numberOfBlocks; blockNum++) {
	  let prefix0 = "_" + blockNum
      for(let col = 0; col < this.valuesPerLine; col++) {
		let prefix1 = prefix0 + '_' + col
	    $('#memColNum' + prefix1).html(this.columnNum2String(col))
	  }
	}
	for(let row = 0; row < this.numberOfRows; row++) {
	  $('#rowNum_' + row).html(this.lineNum2String(row))
	  
	}
  }
  
  generateHtml() {
	let numberOfBlocks = 4
	let rowsPerBlock = this.numberOfRows / 4
	  
	let h = '<h2>memory</h2>'
	h += "<table><tr>"
	for(let blockNum = 0; blockNum < numberOfBlocks; blockNum++) {
      h += '<td><table>'
	  //console.log('numberOfRows =' + numberOfRows)
	  h += '<tr><th>#</th>'
	  let prefix0 = "_" + blockNum
	  for(let col = 0; col < this.valuesPerLine; col++) {
		let prefix1 = prefix0 + '_' + col
        h += '<th id="memColNum' + prefix1 + '">' + this.columnNum2String(col) + '</th>'
	  }
	  h += '</tr>'
	  for(let row = blockNum * rowsPerBlock; row < (blockNum + 1) * rowsPerBlock; row++) {
        h += '<tr><th id="rowNum_' + row + '">' + this.lineNum2String(row) + '</th>'
        for(let col = 0; col < this.valuesPerLine; col++) {
          let adr = row * this.valuesPerLine + col
		  h += '<td id="cell_' + adr + '">' + this.memory.data[adr] + '</td>'
	    }
	    h += '</tr>'
	  }
	  h += '</table></td>'
	}
	h += "</tr></table>"
	$('#mem').html(h);
  }
  
  // es wurde ins Memory geschrieben
  // im Falle des VI caches, wird bei einem write miss
  // zuerst vom Memory gelesen und dann geschrieben
  memoryChanged(adr) {
	//console.log("DEBUG MemoryView.memoryChanged(adr=" + adr + ")")
	let selector = '#cell_' + adr
	let value = this.memory.data[adr]
	//console.log("DEBUG " + selector + "=" + value)
	$(selector).text(value)
	$(selector).filter('.read').addClass('read_and_changed')
	$(selector).not('.read').addClass('changed')
  }
  
  // es wurde vom Memory gelesen
  readFromMemory(base, arraySize) {
	for(let i = 0; i < arraySize; i++) {
	  let adr = base + i
	  //console.log("DEBUG read from adr=" + adr)
	  let selector = '#cell_' + adr
	  $(selector).addClass('read')
	}
  }
}

class CpuView {
  numberSystem2String(base) {
    let strings = {2: 'bin', 8: 'oct', 10: 'dec', 16: 'hex'}
    return strings[base]
  }	
  
  verifyAddressInput(adrStr) {
	adrStr = adrStr.trim()
    let regExs = {2: /^[01]+$/, 8: /^[01234567]+$/, 10: /^\d+$/, 16: /^[0123456789abcdef]+$/i}
	let regEx = regExs[this.adrNumberSystemBase]
	let valid = regEx.test(adrStr)
	if(!valid) {
	  alert('ERROR "' + adrStr + '" ' + this.numberSystem2String(this.adrNumberSystemBase) + ' is not a valid address!')
	}
	return valid
  }
	
  constructor(cpu, cpuId, adrNumberSystemBase, memSize) {
	this.memSize = memSize
	this.adrNumberSystemBase = adrNumberSystemBase
	this.cpu = cpu
	this.cpuId = cpuId
  }
	
  generateCpuHtml() {
	let prefix = '_' + this.cpuId
	let h = '<h2>cpu #' + this.cpuId + '</h2>'
	h += '<form id="cpuForm' + prefix + '">'
	h += '<table>'
    h += '<tr><td><label for="cpuAddress' + prefix + '">address:</label></td>'
    h += '<td><input type="text" id="cpuAddress' + prefix + '" value="0" maxlength="9" size="9">'
	h += ' <span id="adrNumSuffix' + prefix + '">' + this.numberSystem2String(this.adrNumberSystemBase) + '</span></td></tr>'
	h += '<tr><td><label for="cpuData' + prefix + '">data:</label></td>'
	h += '<td><input type="text" id="cpuData' + prefix + '" value="0" maxlength="4" size="4"><br></rd></tr>'
	h += '<tr><td colspan="2"><button type="button" id="cpuStoreButton' + prefix + '">store</button>'
	h += '<button type="button" id="cpuLoadButton' + prefix + '">load</button></td></tr>'
	h += '</table></form>'
	$('#cpu' + prefix).html(h);
  }
  
  changeAdrNumberSystem(adrNumberSystemBase) {
	this.adrNumberSystemBase = adrNumberSystemBase
	let prefix0 = '_' + this.cpuId
    $('#adrNumSuffix' + prefix0).html(this.numberSystem2String(adrNumberSystemBase))
  }
}

// cache and cpu (because they belong together)
class CacheView {
  columnNum2String(colNum) {
	let maxNum = (1 << this.cache.numberOfAddressBits) - 1
	//console.log('DEBUG maxNum=' + maxNum)
	let maxLength = maxNum.toString(this.adrNumberSystemBase).length
	let str = colNum.toString(this.adrNumberSystemBase)
	//console.log('DEBUG maxLength=' + maxLength + ', str=>>>' + str + '<<<')
	return '0'.repeat(maxLength - str.length) + str
  }
  
  lineNum2String(lineNum) {
	let maxNum = this.cache.cacheLines.length - 1
	let maxLength = maxNum.toString(this.adrNumberSystemBase).length
	let str = lineNum.toString(this.adrNumberSystemBase)
	return '0'.repeat(maxLength - str.length) + str
  }

  tag2String(tag) {
	let maxNum = (this.memSize - 1) >> this.cache.numberOfAddressBits
	let maxLength = maxNum.toString(this.adrNumberSystemBase).length
	let str = tag.toString(this.adrNumberSystemBase)
	return '0'.repeat(maxLength - str.length) + str
  }
	
  constructor(cache, cacheId, adrNumberSystemBase, memSize) {
	this.memSize = memSize
	this.adrNumberSystemBase = adrNumberSystemBase
	this.cache = cache
	this.cacheId = cacheId
  }
  
  changeAdrNumberSystem(adrNumberSystemBase) {
	this.adrNumberSystemBase = adrNumberSystemBase
	console.log('DEBUG CacheView.changeAdrNumberSystem(' + adrNumberSystemBase + ')')
	let prefix0 = '_' + this.cacheId
	let numberOfColumns = (1 << this.cache.numberOfAddressBits)
	for(let col = 0; col < numberOfColumns; col++) {
	  let prefix1 = prefix0 + '_' + col
	  $('#colNum' + prefix1).html(this.columnNum2String(col))
	}
	for(let row = 0; row < this.cache.cacheLines.length; row++) {
      let prefix1 = prefix0 + '_' + row
	  $('#lineNumber' + prefix1).html(this.lineNum2String(row))
	  $('#tag' + prefix1).html(this.tag2String(this.cache.cacheLines[row].tag))
	}
  }
  
  stateText(state) {
	switch(state) {
	  case States.INVALID:
	    return 'invalid'
	  case States.VALID:
	    return 'valid'      
      case States.SHARED:
	    return 'shared'
	  case States.MODIFIED:
	    return 'modified'
      case States.EXCLUSIVE:
	    return 'exclusive'
	  case States.OWNED:
	    return 'owned'
	  default:
	    return 'ERROR'
	}
  }
  
  generateCacheHtml() {
	console.log('DEBUG generateCacheHtml()')
    let protocolText = null
	if(this.cache instanceof CacheVI) {
	  protocolText = 'VI'
	} else if(this.cache instanceof CacheMSI) {
	  protocolText = 'MSI'
	} else if(this.cache instanceof CacheMESI) {
	  protocolText = 'MESI'
	} else if(this.cache instanceof CacheMOSI) {
	  protocolText = 'MOSI'
	} else if(this.cache instanceof CacheMOESI) {
	  protocolText = 'MOESI'
	}
	
	let prefix0 = '_' + this.cacheId
	let h = '<h2>' + protocolText + ' cache #' + this.cacheId + '</h2>'
	h += '<table id="cacheTab' + prefix0 + '">'
	h += '<tr><th>#</th><th>state</th><th>tag</th><th>time used</th>'
	let arraySize = 1 << this.cache.numberOfAddressBits;
	for(let index = 0; index < arraySize; index++) {
      let prefix1 = prefix0 + '_' + index
	  h+= '<th id="colNum' + prefix1 + '">' + this.columnNum2String(index) + '</th>'
	}
	h += '</tr>'
	for(let lineNum = 0; lineNum < this.cache.numberOfCacheLines; lineNum++) {
	  let line = this.cache.cacheLines[lineNum];
	  let prefix1 = prefix0 + '_' + lineNum
	  h += '<tr id="line' + prefix1 + '">'
	  h += '<td id="lineNumber' + prefix1 + '">' + this.lineNum2String(lineNum) + '</td>'
	  h += '<td id="state' + prefix1 + '">' + this.stateText(line.state) + '</td>'
	  h += '<td id="tag' + prefix1 + '">' + this.tag2String(line.tag) + '</td>'
	  h += '<td id="timeUsed' + prefix1 + '">' + line.timeUsed + '</td>'
	  //console.log("DEBUG line.values.data.length=" + line.values.data.length)
      for(let index = 0; index < arraySize; index++) {
		let prefix2 = prefix1 + '_' + index
		h+= '<td id="index' + prefix2 + '">' + line.values[index] + '</td>'
	  }
	  h += '</tr>'
	}
	h += '</table>'
	$('#cache' + prefix0).html(h);
  }
  
  cacheLineStateChanged(lineNumber) {
	console.log("DEBUG cacheLineStateChanged(lineNumber=" + lineNumber + ')')
	let selector = '#state_' + this.cacheId + '_' + lineNumber
	let state = this.cache.cacheLines[lineNumber].state
	console.log("DEBUG selector=" + selector + ", state=" + state + ', stateText=' + this.stateText(state))
	$(selector).html(this.stateText(state))
	$(selector).addClass('changed')
  }
  
  cacheLineTagChanged(lineNumber) {
	//console.log("DEBUG cacheLineTagChanged(lineNumber=" + lineNumber + ')')
    let selector = '#tag_' + this.cacheId + '_' + lineNumber
	let tag = this.cache.cacheLines[lineNumber].tag
	//console.log("DEBUG " + selector + "=" + tag)
	$(selector).html(this.tag2String(tag))
	$(selector).addClass('changed')
  }
  
  cacheLineTimeUsedChanged(lineNumber) {
	//console.log("DEBUG cacheLineTimeUsedChanged(lineNumber=" + lineNumber + ')')
	let selector = '#timeUsed_' + this.cacheId + '_' + lineNumber
	let timeUsed = this.cache.cacheLines[lineNumber].timeUsed
	//console.log("DEBUG " + selector + "=" + timeUsed)
	$(selector).html(timeUsed)
	$(selector).addClass('changed')
  }
  
  cacheLineValueChanged(lineNumber, index) {
    //console.log("DEBUG cacheLineChanged(lineNumber=" + lineNumber + ", index=" + index + ")")
	let selector = '#index_' + this.cacheId + '_' + lineNumber + '_' + index
	let value = this.cache.cacheLines[lineNumber].values[index]
	//console.log("DEBUG " + selector + "=" + value)
	$(selector).text(value)
	//$(selector).addClass('changed')
	$(selector).filter('.read').addClass('read_and_changed')
	$(selector).not('.read').addClass('changed')
  }
  
  // event routine is triggered when all values of one cache line are read
  cacheLineRead(lineNumber) {
	let arraySize = 1 << this.cache.numberOfAddressBits
	for(let i = 0; i < arraySize ;i++) {
      this.cacheRead(lineNumber, i)
	}
  }
  
  // event routine is triggered when one value in cache is read
  cacheRead(lineNumber, index) {
	//console.log("DEBUG cacheRead(lineNumber=" + lineNumber + ", index=" + index + ")")
	let selector = '#index_' + this.cacheId + '_' + lineNumber + '_' + index
	//$(selector).addClass('read')
	$(selector).filter('.changed').addClass('read_and_changed')
	$(selector).not('.changed').addClass('read')
  }
}

class BusView {
  constructor(bus, memSize, numberOfAddressBits, adrNumberSystemBase) {
	this.bus = bus
	this.memSize = memSize
	this.numberOfAddressBits = numberOfAddressBits
	this.adrNumberSystemBase = adrNumberSystemBase
	this.clear()
  }
  
  changeAdrNumberSystem(adrNumberSystemBase) {
    this.adrNumberSystemBase = adrNumberSystemBase
  }
	
  tag2String(tag) {
	let maxNum = (this.memSize - 1) >> this.numberOfAddressBits
	let maxLength = maxNum.toString(this.adrNumberSystemBase).length
	let str = tag.toString(this.adrNumberSystemBase)
	return '0'.repeat(maxLength - str.length) + str
  }
  
  clear() {
	$('#busMessages').empty()
  }
  
  message(msg) {
	$('#busMessages').append(this.bus.clock.time + ': ' + msg + '<br>')
  }
	
  loadPlaced(reader, adr) {
	this.message(reader.name + ': load: address=' + adr)
  }	
  
  storePlaced(writer, adr, word) {
	this.message(writer.name + ': store: address=' + adr + ', word=' + word)
  }
	
  writeBackPlaced(writer, tag, data) {
	this.message(writer.name + ': write back (flush): tag=' + this.tag2String(tag) + ', data=[' + data.join(', ') + ']')
  }
  
  invalidatePlaced(writer, tag) {
	console.log('BusView.invalidatePlaced(writer.name=' + writer.name + ', tag=' + this.tag2String(tag))
	this.message(writer.name + ': invalidate: tag=' + this.tag2String(tag))
  }
  
  writeMissPlaced(writer, tag) {
	this.message(writer.name + ': write miss: tag=' + this.tag2String(tag))
  }
  
  readMissPlaced(reader, tag) {
	this.message(reader.name + ': read miss: tag=' + this.tag2String(tag))
  }
  
  responseFromCache(i, data) {
	this.message('cache #' + i + ': response: data=[' + data.join(', ') + ']')
  }
  
  responseFromMemory(data) {
	this.message('memory: response: data=[' + data.join(', ') + ']')
  }
  
  wordResponseFromMemory(word) {
	this.message('memory: response: word=' + word)
  }
}

class SystemView {
  constructor(computerSystem) {
	console.log('DEBUG SystemView.constructor(computerSystem=' + computerSystem + ')')
	this.computerSystem = computerSystem
  }
	
  generateHtml() {
    let c1 = this.computerSystem.cpus
    let h = '<table>'

    h += '<tr>'
	for(let i = 0; i < c1.length; i++) {
	  h += '<td><div id="cpu_' + i + '" class="cpu">loading....</div></td>'
	}  
	h += '</tr>'
	h += '<tr>'
	for(let i = 0; i < c1.length; i++) {
	  h += '<td class="wire"><img alt="Linien" src="parallel_vertical_lines.svg"></td>'
	}
	h += '</tr>'
		
	if(this.computerSystem instanceof SystemWithCaches) {
      console.log('DEBUG has caches')
      let c2 = this.computerSystem.caches
      h += '<tr>'
	  for(let i = 0; i < c2.length; i++) {
        h += '<td><div id="cache_' + i + '" class="cache">loading...</div></td>'
	  }  
      h += '</tr>'
	  h += '<tr>'
	  for(let i = 0; i < c2.length; i++) {
        h += '<td class="wire"><img alt="Linien" src="parallel_vertical_lines.svg"></td>'
	  }
	  h += '<tr>'
	} else {
	  console.log('DEBUG does not have caches')
	}
	
    h += '</table>'
	$('#cpusAndCaches').html(h)
  }
}

function resetHighlights() {
  $(".changed,.read,.read_and_changed").removeClass('read changed read_and_changed')
}

function reset() {
  let protocol = parseInt($('#protocol').val())
  let numberOfCpus = parseInt($('#numberOfCpus').val())
  let offsetBits = parseInt($('#offsetBits').val())
  let numberOfCacheLines = parseInt($('#numberOfCacheLines').val())
  let numberOfMemoryLines = parseInt($('#numberOfMemoryLines').val())
  let memorySize = numberOfMemoryLines * (1 << offsetBits)
  if(numberOfCacheLines > numberOfMemoryLines) {
	let msg = 'WARNING: Usually memory should be bigger as cache!\n'
	msg += 'Number of memory lines: ' + numberOfMemoryLines + '\n'
	msg += 'Number of cache lines: ' + numberOfCacheLines + '\n'
	alert(msg)
  }
  //console.log("adrNumberSystemBase=" + adrNumberSystemBase)
  //console.log('DEBUG reset')
  
  if(protocol == CacheProtocols.NO_CACHE) {
	console.log('DEBUG no Caches')
    computerSystem = new SystemNoCaches(memorySize, numberOfCpus)
  } else {
	console.log('DEBUG new Caches')
	computerSystem = new SystemWithCaches(memorySize, numberOfCpus, protocol, numberOfCacheLines, offsetBits)
  }    
 
  clockUI = new ClockView(computerSystem.clock)
  computerSystem.clock.registerObserver(clockUI)
  computerSystem.clock.reset()
  
  memoryUI = new MemoryView(computerSystem.memory, 1 << offsetBits, adrNumberSystemBase)
  computerSystem.memory.registerObserver(memoryUI)
  memoryUI.generateHtml();
  
  busUI = new BusView(computerSystem.bus, memorySize, offsetBits, adrNumberSystemBase)
  computerSystem.bus.registerObserver(busUI)
  
  systemUI = new SystemView(computerSystem)
  systemUI.generateHtml()

  cpuUIs = new Array(numberOfCpus)
  if(computerSystem.caches != null) {
	cacheUIs = new Array(numberOfCpus)
  }
  for(let i = 0; i < numberOfCpus; i++) {
	//console.log('initialize cacheUIs[' + i + ']')
	cpuUIs[i] = new CpuView(computerSystem.cpus[i], i, adrNumberSystemBase, memorySize)
	cpuUIs[i].generateCpuHtml();
	
	if(computerSystem instanceof SystemWithCaches) {
      cacheUIs[i] = new CacheView(computerSystem.caches[i], i, adrNumberSystemBase, memorySize)
      cacheUIs[i].generateCacheHtml()
      computerSystem.caches[i].registerObserver(cacheUIs[i])
	}
  
    $('#cpuStoreButton_' + i).click(function(event) {
	  resetHighlights()
	  busUI.clear()
	  let htmlId = event.target.id
	  //console.log('event.target.id=' + htmlId)
      let id = htmlId.charAt(htmlId.length - 1)
  	  console.info('INFO CPU #' + id + ' STORE BUTTON CLICKED')
	  let adrStr = $('#cpuAddress_' + id).val()
	  if(cpuUIs[id].verifyAddressInput(adrStr)) {
	    adr = parseInt(adrStr, adrNumberSystemBase)
	    let val = $('#cpuData_' + id).val()
	    computerSystem.cpus[id].store(adr, val)
	    selector = '#cpuData_' + id
	    $(selector).addClass('read')
	  }
    })
  
    $('#cpuLoadButton_' + i).click(function(event) {
      resetHighlights()
	  busUI.clear()
	  let htmlId = event.target.id
	  //console.log('event.target.id=' + htmlId)
      let id = htmlId.charAt(htmlId.length - 1)
	  console.info('INFO  CPU #' + id + ' LOAD BUTTON CLICKED')
	  let adrStr = $('#cpuAddress_' + id).val()
	  if(cpuUIs[id].verifyAddressInput(adrStr)) {
	    adr = parseInt(adrStr, adrNumberSystemBase)
	    let val = computerSystem.cpus[id].load(adr)
	    let selector = '#cpuData_' + id
	    //console.log('DEBUG $(' + selector + ').html(' + val + ')')
	    $(selector).val(val)
	    $(selector).addClass('changed')
	  }
    })
  }
}

function changeAdrNumberSystemBase(base) {
  adrNumberSystemBase = base
  for(let i = 0; i < computerSystem.cpus.length; i++) {
    cpuUIs[i].changeAdrNumberSystem(base)
  }
  if(computerSystem instanceof SystemWithCaches) {
    for(let i = 0; i < computerSystem.caches.length; i++) {
      cacheUIs[i].changeAdrNumberSystem(base)
    }
  }
  busUI.changeAdrNumberSystem(base)
  memoryUI.changeAdrNumberSystem(base)
}

$(function() {
  console.log('DEBUG document loaded')
  reset()
  
  $('#changeButton').click(function() {
    //console.log('change button clicked')
	reset()
  })
  
  $('#defaultButton').click(function() {
    //console.log('default button clicked')
	$('#numberOfCpus').val(3)
    $('#offsetBits').val(2)
    $('#numberOfCacheLines').val(3)
    $('#numberOfMemoryLines').val(16)
	reset()
  })
  
  $('#numberSystemChangeButton').click(function() {
    //console.log('number system change button clicked')
	let baseStr = $("#numberSystem").val()
	let base = parseInt(baseStr)
    changeAdrNumberSystemBase(base)
  })
  
  $('#numberSystemDefaultButton').click(function() {
    //console.log('number system default button clicked')
	$('#numberSystem').val(10)
    changeAdrNumberSystemBase(10)
  })
})
