const States = {
  INVALID: 1, // does not exist
  VALID: 2, // just another name for shared in VI protocol
  SHARED: 3,
  MODIFIED: 4, // single copy and modified
  EXCLUSIVE: 5, // single copy but not yet modified
  OWNED: 6 // already modified but other caches may have copy
}

const ComponentTypes = {
  MEMORY: 1,
  CACHE: 2,
}

const CacheProtocols = {
  NO_CACHE: 1,
  VI: 2,
  MSI: 3,
  MESI: 4,
  MOSI: 5, // noch nicht implementiert
  MOESI: 6
}

// a very simple clock
class Clock {
  constructor() {
    this.time = 0
  }
 
  registerObserver(observer) {
    this.observer = observer
  }
  
  inc() {
    this.time++
	if(this.observer) {
	  this.observer.clockTicked()
	}
  }
  
  // beim Zugriff auf Memory vergeht etwas mehr Zeit
  memoryInc() {
    this.time = this.time + 5
	if(this.observer) {
	  this.observer.clockTicked()
	}
  }
  
  reset() {
	this.time = 0
	if(this.observer) {
	  this.observer.clockTicked()
	}
  }
}

// memory is passive
class Memory {
  constructor(arraySize) {
    this.data = []
    this.observer = null
    for(let i = 0; i < arraySize; i++) {
      this.data[i] = 0;
    }
  }
  
  registerObserver(observer) {
    this.observer = observer
  }
  
  // write a cache line (or any other array) back to memory
  // also known as "flush"
  writeBack(base, data) {
    console.log("DEBUG Memory.writeBack(base=" + base + ", data=...)")
    for(let i = 0; i < data.length; i++) {
      let adr = base + i
      this.data[adr] = data[i]
	  if(this.observer) {
        this.observer.memoryChanged(adr)
	  }
    }
  }
  
  // read a cache line (or any other array) from memory
  read(base, arraySize) {
	//console.log("DEBUG Memory.read(base=" + base + ", arraySize=" + arraySize + ")")  
    if((base + arraySize) > this.data.length) {
      console.warn("WARN  memory address ' + base + ' + ' + arraySize + ' does not exist :-(")
      return null
    }
    let data = []
    for(let i = 0; i < arraySize; i++) {
      data[i] = this.data[base + i]
    }
	if(this.observer) {
      this.observer.readFromMemory(base, arraySize)
	}
    return data
  }
  
  // stores one word
  store(adr, value) {
	console.log('DEBUG memory.store(adr=' + adr + ', value=' + value + ')')
  	if(adr > this.data.length) {
      console.warn("WARN  memory address ' + base + ' + ' + arraySize + ' does not exist :-(")
      return null
    }
	this.data[adr] = value
	if(this.observer) {
      this.observer.memoryChanged(adr, 1)
	}
  }
  
  // loads one word
  load(adr) {
	console.log('DEBUG memory.load(adr=' + adr + ')')
	if(adr > this.data.length) {
      console.warn("WARN  memory address ' + base + ' + ' + arraySize + ' does not exist :-(")
      return null
    }
	if(this.observer) {
      this.observer.readFromMemory(adr, 1)
	}
	console.log('DEBUG memory.load returns ' + this.data[adr])
	return this.data[adr]
  }
}

class Response {
  constructor(sourceType, values) {
	this.sourceType = sourceType
	this.values = values
  }
}

class Bus {
  constructor() {
	// if cpus are connected directly to bus, the caches array is empty
    this.caches = []
    this.memory = []
	this.counterLoad = 0
	this.counterStore = 0
	this.counterReadMiss = 0
	this.counterWriteMiss = 0
	this.counterWriteBack = 0
	this.counterInvalidate = 0
	this.counterMemoryResponse = 0
	this.counterCacheResponse = 0
  }
  
  getCounterMemory() {
	return this.counterStore +
	  this.counterLoad +
	  this.counterWriteBack +
	  this.counterMemoryResponse;
  }
  
  getCounterTotal() {
	return this.counterStore +
	  this.counterLoad +
	  this.counterWriteBack +
	  this.counterMemoryResponse +
	  this.counterReadMiss +
	  this.counterWriteMiss +
	  this.counterInvalidate;
  }
  
  connectClock(clock) {
    this.clock = clock
  }
  
  connectMemory(mem) {
    this.memory = mem
  }
  
  // if processor is directly connected to bus
  load(reader, adr) {
	console.log('Bus.load(adr=' + adr + ')')
	this.counterLoad++
	this.clock.memoryInc()
	let word = this.memory.load(adr)
	if(this.observer) {
	  this.observer.loadPlaced(reader, adr)
	}
	this.clock.memoryInc()
	if(this.observer) {
	  this.observer.wordResponseFromMemory(word)
	}
	console.log('Bus.load returns ' + word)
	return word
  }
  
  // if processor is directly connected to bus
  store(writer, adr, word) {
	console.log('Bus.store(adr=' + adr + ', word=' + word + ')')
	this.counterStore++
	this.clock.memoryInc()
	this.memory.store(adr, word)
	if(this.observer) {
	  this.observer.storePlaced(writer, adr, word)
	}
  }
  
  connectCaches(caches) {
	console.log("DEBUG Bus.connectCaches caches.length=" + caches.length)
    this.caches = caches
  }
  
  registerObserver(observer) {
	this.observer = observer
  }
  
  // write cache line back to memory via bus
  // also known as "flush"
  placeWriteBack(writer, tag, numberOfAddressBits, cacheLineValues) {
	console.log('INFO  Bus.placeWriteBack(tag=' + tag + ', cacheLineValues=...)')
	this.counterWriteBack++
	this.clock.memoryInc()
	if(this.observer) {
	  this.observer.writeBackPlaced(writer, tag, cacheLineValues)
	}
    let base = tag << numberOfAddressBits
    this.memory.writeBack(base, cacheLineValues)
	for(let i = 0; i < this.caches.length; i++) {
      // keine Nachricht an sich selber schicken
      if(this.caches[i] != writer) {
        this.caches[i].snoopWriteBack(tag)
      }
    }
  }
  
  // cache line state: shared -> modified
  // also known as "BusRdX" or "place invalidate"
  // cache line state: shared -> modified
  placeInvalidate(writer, tag, numberOfAddressBits) {
	console.log('INFO  Bus.placeInvalidate(writer=' + writer + ', tag=' + tag + ', numberOfAdressBits=' + numberOfAddressBits + ')')
	this.counterInvalidate++
	this.clock.inc()
	if(this.observer) {
	  this.observer.invalidatePlaced(writer, tag)
	}
    for(let i = 0; i < this.caches.length; i++) {
      // keine Nachricht an sich selber schicken
      if(this.caches[i] != writer) {
        this.caches[i].snoopInvalidate(tag)
      }
    }
  }
  
  // cache line state: invalid -> modified
  placeWriteMiss(writer, tag, numberOfAddressBits) {
    console.log('INFO  Bus.placeWriteMiss(writer=' + writer.name + ', tag=' + tag + ', numberOfAdressBits=' + numberOfAddressBits + ')')	  
	this.counterWriteMiss++
	if(this.observer) {
	  this.observer.writeMissPlaced(writer, tag)
	}
    let data = null
    // erst Mal die anderen Caches anfragen
    // es kann passieren, dass mehrere antworten
	
	console.log('Bus.placeWriteMiss caches.length=' + this.caches.length)
    for(let cacheId = 0; cacheId < this.caches.length; cacheId++) {
      // keine Nachricht an sich selber schicken
      if(this.caches[cacheId] != writer) {
        let tmp = this.caches[cacheId].snoopWriteMiss(tag)
		if(tmp != null) {
		  data = tmp
		  if(this.observer) {
		    this.observer.responseFromCache(cacheId, data)
	      }
		}

      }
    }
    if(data == null) {
      // console.log('DEBUG Bus.placeWriteMiss: as last option read from memory')
	  this.counterMemoryResponse++
	  this.clock.memoryInc()
      let base = tag << numberOfAddressBits
      let arraySize = 1 << numberOfAddressBits  
      data = this.memory.read(base, arraySize)
	  this.clock.inc()
	  if(this.observer) {
	    this.observer.responseFromMemory(data)
	  }
    } else {
	  this.counterCacheResponse++
	  this.clock.inc()
	}
    return data;
  }
  
  // cache line state: invalid -> shared
  // to do, reader needs information, if response comes from other cache or from memory
  placeReadMiss(reader, tag, numberOfAddressBits) {
	console.log('INFO  Bus.placeReadMiss(reader=' + reader.name + ', tag=' + tag + ', numberOfAdressBits=' + numberOfAddressBits + ')')
	this.counterReadMiss++
	let sourceType = null
	if(this.observer) {
	  this.observer.readMissPlaced(reader, tag)
	}
    let data = null
    // erst Mal die anderen Caches anfragen
    // es kann passieren, dass mehrere antworten
    for(let cacheId = 0; cacheId < this.caches.length; cacheId++) {
      // keine Nachricht an sich selber schicken
      if(this.caches[cacheId] != reader) {
		let tmp = this.caches[cacheId].snoopReadMiss(tag)
		if(tmp != null) {
		  sourceType = ComponentTypes.CACHE
		  data = tmp
		  if(this.observer) {
		    this.observer.responseFromCache(cacheId, data)
	      }
		}
      }
    }
    if(data == null) {
	  this.counterMemoryResponse++
	  this.clock.memoryInc()	  
	  sourceType = ComponentTypes.MEMORY
      console.log('DEBUG Bus.placeReadMiss: as last option read from memory')
      let base = tag << numberOfAddressBits
      let arraySize = 1 << numberOfAddressBits
      data = this.memory.read(base, arraySize)
	  if(this.observer) {
	    this.observer.responseFromMemory(data)
	  }
    } else {
	  this.counterCacheResponse++
	  this.clock.inc()
	}
	
	console.log('DEBUG Bus.placeReadMiss sourceType=' + sourceType)
    return new Response(sourceType, data)
  }
}

class CacheLine {
  constructor(numberOfAddressBits) {
    // other attributes are not relevant if state == invalid
    this.state = States.INVALID; 
    this.tag = 0;
    this.timeUsed = 0
    let arraySize = 1 << numberOfAddressBits
    // initialize cache line values array with zeros
    this.values = []
    for(let i = 0; i < arraySize; i++) {
      this.values[i] = 0;
    }
  }
}

class Cpu {
  // dataSource is a cache if connected to a private cache
  // or bus if connected directly to the bus
  constructor(name) {
	this.name = name
	console.log('DEBUG cpu ' + name + ' constructor')
  }
  
  connect(dataSource) {
	console.log('DEBUG cpu ' + this.name + ' connect')
	this.dataSource = dataSource  
  }
  
  load(adr) {
	console.log('DEBUG cpu ' + this.name + ' load(adr=' + adr + ')')
	let word = this.dataSource.load(this, adr)
	console.log('DEBUG cpu ' + this.name + ' load returns ' + word)
	return word
  }
  
  store(adr, word) {
	console.log('DEBUG cpu ' + this.name + ' store(adr=' + adr + ', word=' + word + ')')
	this.dataSource.store(this, adr, word)
  }
}

class AbstractCache {
  /*
    0 bit -> 0, 0 (1--) only one value in cache line, index is always zero
    1 bit -> 1, 1 (2--) two values in cache line with index 0 and 1
    2 bit -> 11, 3 (4--) four value in cache line with binary indexes 00..11
    3 bit -> 111, 7 (8--) and so on
    4 bit -> 1111, 15 (16--)
  */
  generateAndMask(numberOfAddressBits) {
    /*
    this.andMask = 1
    for(let i = 0; i < numberOfAddressBits; i++) {
      this.andMask = (this.andMask << 1) + 1
    }
    */
    let andMask = (1 << numberOfAddressBits) - 1
    //console.log("DEBUG andMask=" + andMask)
    return andMask
  }
  
  getBase(tag) {
    //console.log("DEBUG Cache.getBase()")
    let base = tag << this.numberOfAddressBits
    //console.log("DEBUG tag=" + tag + "--> base=" + base)
    return base
  }  
    
  constructor(name, numberOfCacheLines, numberOfAddressBits) {
	console.log('AbstractCache.constructor(name=' + name + ', numberOfCacheLines=' + numberOfCacheLines + ', numberOfAddressBits=' + numberOfAddressBits + ')')
    // name only to distinguish this cache from others while debugging
    this.name = name
    this.numberOfCacheLines = numberOfCacheLines;
    this.numberOfAddressBits = numberOfAddressBits;
    this.andMask = this.generateAndMask(numberOfAddressBits);   
    this.cacheLines = [];
    for(let i = 0; i < this.numberOfCacheLines; i++) {
      this.cacheLines[i] = new CacheLine(this.numberOfAddressBits);
    }
  }
  
  getState(lineNum) {
	return this.cacheLines[lineNum].state
  }
  
  // sets the state of a cache line and informs observer if it changed
  setState(lineNum, state) {
	// did state change?
	if(this.cacheLines[lineNum].state != state) {
      this.cacheLines[lineNum].state = state
	  // is there an observer?
	  if(this.observer) {
        this.observer.cacheLineStateChanged(lineNum)
	  }
	}
  }
  
  // sets timestamp for least recently used strategy
  // and informs observer
  setAccessTime(lineNum) {
	this.cacheLines[lineNum].timeUsed = this.clock.time
	if(this.observer) {
      this.observer.cacheLineTimeUsedChanged(lineNum)
	}
  }
  
  getValue(lineNum, offset) {
	this.setAccessTime(lineNum)
	if(this.observer) {
      this.observer.cacheRead(lineNum, offset)
	}
	return this.cacheLines[lineNum].values[offset]
  }
  
  getValues(lineNum) {
	this.setAccessTime(lineNum)
	if(this.observer) {
      this.observer.cacheLineRead(lineNum)
	}
	return this.cacheLines[lineNum].values
  }
  
  getValuesAndInvalidate(lineNum) {
	this.setState(lineNum, States.INVALID)	  
	if(this.observer) {
      this.observer.cacheLineRead(lineNum)
	}
	return this.cacheLines[lineNum].values
  }

  setValue(lineNum, offset, value) {
	this.setAccessTime(lineNum)
	// wurde der Wert beim Schreiben wirklich geaendert?
	//if(value != this.cacheLines[lineNum].values[offset]) {
      this.cacheLines[lineNum].values[offset] = value
	  if(this.observer) {
        this.observer.cacheLineValueChanged(lineNum, offset)
	  }
    //}	  
  }
  
  setValues(lineNum, values) {
	this.setAccessTime(lineNum)
	let line = this.cacheLines[lineNum]
	line.values = values
	if(this.observer) {
      for(var i = 0; i < line.values.length; i++) {
		// wurde beim Schreiben wirklich etwas geaendert?
		//if(line.values[i] != values[i]) {
          this.observer.cacheLineValueChanged(lineNum, i)
		  console.log('DEBUG ' + this.name + ' cache line value changed')
		//}
      }
    }
  }
  
  setTag(lineNum, tag) {
    this.cacheLines[lineNum].tag = tag
	if(this.observer) {
      this.observer.cacheLineTagChanged(lineNum)
	}
  }
  
  connectBus(bus) {
    this.bus = bus
  }
  
  connectClock(clock) {
    this.clock = clock
  }
  
  registerObserver(observer) {
    this.observer = observer
  }
  
  // least recently used algorithm
  // call this function only
  //   if there is at least one valid cache line or
  //   usually if cache is full
  findOldestLine() {
    let minimum = Number.MAX_VALUE
    let lineNumWithMin = null
    for(let lineNum = 0; lineNum < this.numberOfCacheLines; lineNum++) {
      let line = this.cacheLines[lineNum]
      if((line.timeUsed < minimum) && (line.state != States.INVALID)) {
        minimum = line.timeUsed
        lineNumWithMin = lineNum
      }
    }
    return lineNumWithMin;
  }
 
  // returns line num if found or
  // null if cache is full
  findInvalidLine() {
    for(let lineNum = 0; lineNum < this.numberOfCacheLines; lineNum++) {
      let line = this.cacheLines[lineNum];
      if(line.state == States.INVALID) {
        return lineNum
      }
    }
    return null
  }
  
  // checks if line is already in cache
  // returns line number if cache hit
  // or null if cache miss
  lineInCache(tag) {
    // 2. check, if cache line is already in cache
    for(let lineNum = 0; lineNum < this.numberOfCacheLines; lineNum++) {
      let line = this.cacheLines[lineNum];
	  console.log('DEBUG ' + this.name + ': lineNum=' + lineNum + ', state=' + line.state)
      if((line.tag == tag) && (line.state != States.INVALID)) {
        return lineNum
      }
    }
    return null
  }
  
  dump() {
	console.log('DEBUG ' + this.name + 'dump()')
	let numberOfColumns = 1 << this.numberOfAddressBits
	for(let lineNum = 0; lineNum < this.numberOfCacheLines; lineNum++) {
	  let msg = 'DEBUG   '
	  let line = this.cacheLines[lineNum]
	  msg += lineNum + ' ' + line.state
	  for(let colNum = 0; colNum < this.numberOfColumns; colNum++) {
		msg += ' ' + line.values[colNum]
	  }
	  console.log(msg)
	}
  }
}


/*
  this cache has only 2 states: valid & invalid
  writes are always write-through
 */
class CacheVI extends AbstractCache {
	
  constructor(name, numberOfCacheLines, numberOfAddressBits) {
	console.log('CacheVI constructor(name=' + name + ', numberOfCacheLines=' + numberOfCacheLines + ', numberOfAdressBits=' + numberOfAddressBits + ')')  
	super(name, numberOfCacheLines, numberOfAddressBits)
  }	
	
  // call this function only
  //   if there is at least one valid cache line or
  //   usually if cache is full
  // no write back necessary, because lines are (valid and clean) or (invalid / non-existent)
  evictOldestLine() {
    let lineNum = this.findOldestLine()
    let line = this.cacheLines[lineNum]
    this.setState(lineNum, States.INVALID)
    return lineNum
  }
	
  // returns value
  // easy, if value is in cache
  // otherwise read cache line from memory first
  // if cache full, replace oldest cache line
  // returns one memory or cache entry
  load(reader, adr) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.load(' + adr + ')')
    let tag = adr >> this.numberOfAddressBits;
    let index = adr & this.andMask
    let line = null
    console.log('DEBUG ' + this.name + ' tag=' + tag + ", index=" + index)
    
    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    console.log('DEBUG ' + this.name + ' lineInCache(' + tag + ') returns ' + lineNum)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ' read cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        console.log('DEBUG ' + this.name + ' but cache is not full :-|')
      }
      this.setTag(lineNum, tag)
	  let response = this.bus.placeReadMiss(this, tag, this.numberOfAddressBits)
      this.setValues(lineNum, response.values)
      console.log('DEBUG ' + this.name + ' got cache line data from bus')
      this.setState(lineNum, States.VALID)
    } else {
      console.log('DEBUG ' + this.name + ' read cache hit. lineNum=' + lineNum + ' :-)')
    }
	let value = this.getValue(lineNum, index)
	console.log('DEBUG ' + this.name + ' load returns ' + value)
    return this.getValue(lineNum, index)
  }
  
  store(writer, adr, value) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.store(adr=' + adr + ', value=' + value + ')')
    // split address in tag and index
    let tag = adr >> this.numberOfAddressBits
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ', index=' + index)

    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ' write cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        console.log('DEBUG' + this.name + ' but cache is not full :-|')
      }
      this.setTag(lineNum, tag)
      this.setValues(lineNum, this.bus.placeWriteMiss(this, tag, this.numberOfAddressBits))
	  this.setState(lineNum, States.VALID)
      let arraySize = 1 << this.numberOfAddressBits
    } else {
      console.log('DEBUG ' + this.name + ' write cache hit :-)')

    }

    let oldValues = this.getValues(lineNum)
    if(oldValues[index] != value) {
      this.setValue(lineNum, index, value)
	  this.bus.placeWriteBack(this, tag, this.numberOfAddressBits, this.cacheLines[lineNum].values)
    }
    return  
  }	
	
  // this cache:
  //   not in cache: do nothing
  //   valid:        return cache line values
  // returns cache line values, if exist in this cache
  snoopReadMiss(tag) {
    console.log('DEBUG ' + this.name + '.snoopReadMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      console.log('DEBUG ' + this.name + ': found in this cache')
      return this.getValues(lineNum)
    }
  }
  
  // this cache:
  //   not in cache: do nothing
  //   valid:        return cache line values (and maybe change state to invalid or wait until write back?)
  //                 but snoopWriteBack is currently not implemented
  // returns cache line values, if exist in this cache
  snoopWriteMiss(tag) {
    //console.log('DEBUG ' + this.name + '.snoopWriteMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
	  return this.getValuesAndInvalidate(lineNum)
    }
  }
  
  // the VI-protocol doesn't need invalidate bus messages
  // if line in cache, just change state to invalid
  snoopInvalidate(tag) {
    //console.log('DEBUG ' + this.name + '.snoopInvalidate(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
      this.setState(lineNum, States.INVALID)
    }
  }
  
  snoopWriteBack(tag) {
	console.log('DEBUG ' + this.name + '.snoopWriteBack(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ': not in this cache')
    } else {
      console.log('DEBUG ' + this.name + ': found in this cache')
      this.setState(lineNum, States.INVALID)
    }	  
  }
}


class CacheMSI extends AbstractCache {
	
  constructor(name, numberOfCacheLines, numberOfAddressBits) {
	super(name, numberOfCacheLines, numberOfAddressBits)
	console.log("CacheMSI constructor()")  
  }	
	
  // call this function only
  //   if there is at least one valid cache line or
  //   usually if cache is full
  evictOldestLine() {
    let lineNum = this.findOldestLine()
    let line = this.cacheLines[lineNum]
    if(line.state == States.MODIFIED) {		
      this.bus.placeWriteBack(this, line.tag, this.numberOfAddressBits, line.values)
    }
	this.setState(lineNum, States.INVALID)
    return lineNum
  }	
	
  // returns value
  // easy, if value is in cache
  // otherwise read cache line from memory first
  // if cache full, replace oldest cache line
  // returns one memory or cache entry
  load(reader, adr) {
    this.clock.inc()
    console.log('DEBUG ' + this.name + '.load(' + adr + ')')
    let tag = adr >> this.numberOfAddressBits;
    let index = adr & this.andMask
    let line = null
    console.log('DEBUG ' + this.name + ' tag=' + tag + ", index=" + index)
    
    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    console.log('DEBUG ' + this.name + ' lineInCache(' + tag + ') returns ' + lineNum)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ' read cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        console.log('DEBUG ' + this.name + ' but cache is not full :-|')
      }
      this.setTag(lineNum, tag)
	  let response = this.bus.placeReadMiss(this, tag, this.numberOfAddressBits)
	  console.log('DEBUG ' + this.name + ' got response')
	  for(var i = 0; i < response.values.length; i++) {
		console.log('DEBUG ' + this.name + ' response value[' + i + ']=' + response.values[i])
	  }
	  
	  this.setValues(lineNum, response.values)
      this.setState(lineNum, States.SHARED)
    } else {
      console.log('DEBUG ' + this.name + ' read cache hit. lineNum=' + lineNum + ' :-)')
    }
    return this.getValue(lineNum, index)
  }
  
  store(writer, adr, value) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.store(adr=' + adr + ', value=' + value + ')')
    // split address in tag and index
    let tag = adr >> this.numberOfAddressBits
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ', index=' + index)

    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ' write cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        console.log('DEBUG' + this.name + ' but cache is not full :-|')
      }
      this.setTag(lineNum, tag)
      let values = this.bus.placeWriteMiss(this, tag, this.numberOfAddressBits)
	  this.setValues(lineNum, values)
    } else {
      console.log('DEBUG ' + this.name + ' write cache hit :-)')
	  // only notify other caches if this cache does not already own the cache line
	  if(this.getState(lineNum) == States.SHARED) {
        this.bus.placeInvalidate(this, tag, this.numberOfAddressBits)
	  }
    }
    
    console.log('DEBUG ' + this.name + ' write value to cache line #' + lineNum)    
	this.setValue(lineNum, index, value)
    this.setState(lineNum, States.MODIFIED)
	//this.setAccessTime(lineNum)
    return  
  }	
	
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // reading cache: invalid -> shared
  // this cache:
  //   not in cache: do nothing
  //   shared:       do nothing (maybe share cache line values)
  //   modified:     write back to memory (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopReadMiss(tag) {
    console.log('DEBUG ' + this.name + '.snoopReadMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      console.log('DEBUG ' + this.name + ': found in this cache')
      //let line = this.cacheLines[lineNum]
	  let values = this.getValues(lineNum)
	  // downgrade, if in state modified
      if(this.getState(lineNum) == States.MODIFIED) {
		this.setState(lineNum, States.SHARED)
		this.bus.placeWriteBack(this, tag, this.numberOfAddressBits, values)
      }
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // writing cache: invalid -> modified
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid (and maybe share cache line values)
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopWriteMiss(tag) {
    //console.log('DEBUG ' + this.name + '.snoopWriteMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
	  let values = this.getValues(lineNum)
      // no write back is necessary
	  //, because cache line moves from this cache to writing cache
	  this.setState(lineNum, States.INVALID)
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // also nkown as snoop invalidate
  // writing cache: shared -> modified
  // it is nearly the same as snoopWriteMiss, except there is no return value
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values)
  // returns nothing
  snoopInvalidate(tag) {
    //console.log('DEBUG ' + this.name + '.snoopInvalidate(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
      if(this.getState(lineNum) == States.MODIFIED) {
		let values = this.getValues(lineNum)
        //console.log('DEBUG ' + this.name + ': and is modified, so write back to memory')
        this.bus.placeWriteBack(tag, this.numberOfAddressBits, values)
      }
	  this.setState(lineNum, States.INVALID)
    }
  }
  
  snoopWriteBack(tag) {
	// do nothing
  }
}

class CacheMESI extends AbstractCache {
	
  constructor(name, numberOfCacheLines, numberOfAddressBits) {
	super(name, numberOfCacheLines, numberOfAddressBits)
	console.log("CacheMESI constructor()")  
  }		
	
  // call this function only
  //   if there is at least one valid cache line or
  //   usually if cache is full
  evictOldestLine() {
    let lineNum = this.findOldestLine()
    let line = this.cacheLines[lineNum]
    if(line.state == States.MODIFIED) {
      this.bus.placeWriteBack(this, line.tag, this.numberOfAddressBits, line.values)
    }
	this.setState(lineNum, States.INVALID) // will be changed short after anyway
    return lineNum
  }	
	
  // returns value
  // easy, if value is in cache
  // otherwise read cache line from memory first
  // if cache full, replace oldest cache line
  // returns one memory or cache entry
  load(reader, adr) {
    this.clock.inc()
    console.log('DEBUG ' + this.name + '.load(' + adr + ')')
    let tag = adr >> this.numberOfAddressBits;
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ", index=" + index)
    
    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    //console.log('DEBUG ' + this.name + ' lineInCache(' + tag + ') returns ' + lineNum)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ' read cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        //console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();        
      } else {
        //console.log('DEBUG ' + this.name + ' but cache is not full :-|')
      }
	  this.setTag(lineNum, tag)
      
	  // response from other cache(s) (shared, shared) or from memory (exclusive)?
	  let response = this.bus.placeReadMiss(this, tag, this.numberOfAddressBits)
	  console.log('DEBUG ' + this.name + ' got cache line data from bus. sourceType: ' + response.sourceType)
      this.setValues(lineNum, response.values)
	  if(response.sourceType == ComponentTypes.MEMORY) {
		this.setState(lineNum, States.EXCLUSIVE)
	  } else {
		this.setState(lineNum, States.SHARED)
	  }
    } else {
	  console.log('DEBUG ' + this.name + ' read cache hit :-)')
      //console.log('DEBUG ' + this.name + ' line.values[' + index + ']=' + line.values[index]) // undefined
    }
    
    return this.getValue(lineNum, index)
  }
  
  store(writer, adr, value) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.store(adr=' + adr + ', value=' + value + ')')
    // split address in tag and index
    let tag = adr >> this.numberOfAddressBits
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ', index=' + index)

    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ' write cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        //console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        //console.log('DEBUG' + this.name + ' but cache is not full :-|')
      }
	  this.setTag(lineNum, tag)
      let values = this.bus.placeWriteMiss(this, tag, this.numberOfAddressBits)
	  this.setValues(lineNum, values)
    } else {
      //console.log('DEBUG ' + this.name + ' write cache hit :-)')
 	  line = this.cacheLines[lineNum];
	  // only notify other caches if this cache does not already own the cache line
	  if(line.state == States.SHARED) { // not already modified and not exclusive
        this.bus.placeInvalidate(this, tag, this.numberOfAddressBits)
	  }
    }
    
    //console.log('DEBUG ' + this.name + ' write value to cache line #' + lineNum)    
    this.setState(lineNum, States.MODIFIED)
	this.setValue(lineNum, index, value)
    return  
  }	
	
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // reading cache: invalid -> shared
  // this cache:
  //   not in cache: do nothing
  //   exclusive:    change state to shared
  //   shared:       do nothing (maybe share cache line values)
  //   modified:     write back to memory (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopReadMiss(tag) {
    console.log('DEBUG ' + this.name + '.snoopReadMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      console.log('DEBUG ' + this.name + ': found in this cache')
      //let line = this.cacheLines[lineNum]
	  let values = this.getValues(lineNum)
	  switch(this.getState(lineNum)) {
		case States.EXCLUSIVE:
		  this.setState(lineNum, States.SHARED)
		  break
		case States.MODIFIED:
   		  this.setState(lineNum, States.SHARED)		  
	      this.bus.placeWriteBack(this, tag, this.numberOfAddressBits, values)
		  break
      }
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // writing cache: invalid -> modified
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid (and maybe share cache line values)
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopWriteMiss(tag) {
    //console.log('DEBUG ' + this.name + '.snoopWriteMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
      //let line = this.cacheLines[lineNum]
	  let values = this.getValues(lineNum)
      // no write back is necessary, because cache line moves from this cache to writing cache
      //if(line.state == States.MODIFIED) {
      //  console.log('DEBUG ' + this.name + ': and is modified, so write back to memory')
      //  this.bus.placeWriteBack(tag, this.numberOfAddressBits, line.values)
      //}
	  this.setState(lineNum, States.INVALID)
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // also nkown as snoop invalidate
  // writing cache: shared -> modified
  // it is nearly the same as snoopWriteMiss, except there is no return value
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values)
  // returns nothing
  snoopInvalidate(tag) {
    //console.log('DEBUG ' + this.name + '.snoopInvalidate(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
      //let line = this.cacheLines[lineNum]
	  
      if(this.getState(lineNum) == States.MODIFIED) {
        //console.log('DEBUG ' + this.name + ': and is modified, so write back to memory')
		let values = this.getValues(lineNum)
        this.bus.placeWriteBack(tag, this.numberOfAddressBits, values)
      }
      this.setState(lineNum, States.INVALID)
    }
  }
  
  snoopWriteBack(tag) {
	// do nothing
  }
}

/*
  special state OWNED:
  1. State of cache line is MODIFIED
  2. other cache reads
  3. State becomes OWNED
  4. OWNED Cache line is evicted
  5. Cache line must be written back to memory
*/ 
class CacheMOSI extends AbstractCache {
	
  constructor(name, numberOfCacheLines, numberOfAddressBits) {
	super(name, numberOfCacheLines, numberOfAddressBits)
	console.log("CacheMSI constructor()")  
  }	
	
  // call this function only
  //   if there is at least one valid cache line or
  //   usually if cache is full
  evictOldestLine() {
    let lineNum = this.findOldestLine()
    let line = this.cacheLines[lineNum]
    if(line.state == States.MODIFIED || line.state == States.OWNED) {		
      this.bus.placeWriteBack(this, line.tag, this.numberOfAddressBits, line.values)
    }
	this.setState(lineNum, States.INVALID)
    return lineNum
  }	
	
  /*
    Alias processor read.
    easy, if value is in cache
    otherwise read cache line from memory first
    if cache is full, replace oldest cache line
    returns one memory or cache entry
  */
  load(reader, adr) {
    this.clock.inc()
    console.log('DEBUG ' + this.name + '.load(' + adr + ')')
    let tag = adr >> this.numberOfAddressBits;
    let index = adr & this.andMask
    let line = null
    console.log('DEBUG ' + this.name + ' tag=' + tag + ", index=" + index)
    
    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    console.log('DEBUG ' + this.name + ' lineInCache(' + tag + ') returns ' + lineNum)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ' read cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        console.log('DEBUG ' + this.name + ' but cache is not full :-|')
      }
      this.setTag(lineNum, tag)
	  let response = this.bus.placeReadMiss(this, tag, this.numberOfAddressBits)
	  console.log('DEBUG ' + this.name + ' got response')
	  /*
	  for(var i = 0; i < response.values.length; i++) {
		console.log('DEBUG ' + this.name + ' response value[' + i + ']=' + response.values[i])
	  }
	  */
	  this.setValues(lineNum, response.values)
      this.setState(lineNum, States.SHARED)
    } else {
      console.log('DEBUG ' + this.name + ' read cache hit. lineNum=' + lineNum + ' :-)')
    }
    return this.getValue(lineNum, index)
  }
  
  store(writer, adr, value) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.store(adr=' + adr + ', value=' + value + ')')
    // split address in tag and index
    let tag = adr >> this.numberOfAddressBits
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ', index=' + index)

    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ' write cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        console.log('DEBUG' + this.name + ' but cache is not full :-|')
      }
      this.setTag(lineNum, tag)
      let values = this.bus.placeWriteMiss(this, tag, this.numberOfAddressBits)
	  this.setValues(lineNum, values)
    } else {
      console.log('DEBUG ' + this.name + ' write cache hit :-)')
	  // only notify other caches if this cache does not already own the cache line
	  if(this.getState(lineNum) == States.SHARED) {
        this.bus.placeInvalidate(this, tag, this.numberOfAddressBits)
	  }
    }
    
    console.log('DEBUG ' + this.name + ' write value to cache line #' + lineNum)    
    this.setState(lineNum, States.MODIFIED)
	this.setValue(lineNum, index, value)
	//this.setAccessTime(lineNum)
    return  
  }	
	
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // reading cache: invalid -> shared
  // this cache:
  //   not in cache: do nothing
  //   shared:       do nothing (maybe share cache line values)
  //   modified:     write back to memory (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopReadMiss(tag) {
    console.log('DEBUG ' + this.name + '.snoopReadMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      console.log('DEBUG ' + this.name + ': found in this cache')
      //let line = this.cacheLines[lineNum]
	  let values = this.getValues(lineNum)
	  // downgrade, if in state modified
      if(this.getState(lineNum) == States.MODIFIED) {
		this.setState(lineNum, States.OWNED)
      }
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // writing cache: invalid -> modified
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid (and maybe share cache line values)
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopWriteMiss(tag) {
    //console.log('DEBUG ' + this.name + '.snoopWriteMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
	  let values = this.getValues(lineNum)
      // no write back is necessary
	  //, because cache line moves from this cache to writing cache
	  this.setState(lineNum, States.INVALID)
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // also nkown as snoop invalidate
  // writing cache: shared -> modified
  // it is nearly the same as snoopWriteMiss, except there is no return value
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values?)
  // returns nothing
  snoopInvalidate(tag) {
    //console.log('DEBUG ' + this.name + '.snoopInvalidate(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
      if(this.getState(lineNum) == States.MODIFIED) {
		let values = this.getValues(lineNum)
        //console.log('DEBUG ' + this.name + ': and is modified, so write back to memory')
        this.bus.placeWriteBack(tag, this.numberOfAddressBits, values)
      }
	  this.setState(lineNum, States.INVALID)
    }
  }
  
  snoopWriteBack(tag) {
	// do nothing
  }
}
  
class CacheMOESI extends AbstractCache {
  constructor(name, numberOfCacheLines, numberOfAddressBits) {
	super(name, numberOfCacheLines, numberOfAddressBits)
	console.log("CacheMOESI constructor()")  
  }		
	
  // call this function only
  //   if there is at least one valid cache line or
  //   usually if cache is full
  evictOldestLine() {
    let lineNum = this.findOldestLine()
    let line = this.cacheLines[lineNum]
    if(line.state == States.MODIFIED || line.state == States.OWNED) {
      this.bus.placeWriteBack(this, line.tag, this.numberOfAddressBits, line.values)
    }
	this.setState(lineNum, States.INVALID) // will be changed short after anyway
    return lineNum
  }	
	
  // returns value
  // easy, if value is in cache
  // otherwise read cache line from memory first
  // if cache full, replace oldest cache line
  // returns one memory or cache entry
  load(reader, adr) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.load(' + adr + ')')
    let tag = adr >> this.numberOfAddressBits;
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ", index=" + index)
    
    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    //console.log('DEBUG ' + this.name + ' lineInCache(' + tag + ') returns ' + lineNum)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ' read cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        //console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        //console.log('DEBUG ' + this.name + ' but cache is not full :-|')
      }
	  //line = this.cacheLines[lineNum];
	  this.setTag(lineNum, tag)
      
	  // response from other cache(s) (shared, shared) or from memory (exclusive)?
	  let response = this.bus.placeReadMiss(this, tag, this.numberOfAddressBits)
      this.setValues(lineNum, response.values)
      //console.log('DEBUG ' + this.name + ' got cache line data from bus')
    
	  console.log("DEBUG sourceType: " + response.sourceType)
	  if(response.sourceType == ComponentTypes.MEMORY) {
		this.setState(lineNum, States.EXCLUSIVE)
	  } else {
		this.setState(lineNum, States.SHARED)
	  }
    } else {
      //console.log('DEBUG ' + this.name + ' read cache hit. lineNum=' + lineNum + ' :-)')
      //line = this.cacheLines[lineNum];
      //console.log('DEBUG ' + this.name + ' typeof line=' + typeof line)
      //console.log('DEBUG ' + this.name + ' line.values[' + index + ']=' + line.values[index]) // undefined
    }
    
    return this.getValue(lineNum, index)
  }
  
  store(writer, adr, value) {
    this.clock.inc()
	  
    console.log('DEBUG ' + this.name + '.store(adr=' + adr + ', value=' + value + ')')
    // split address in tag and index
    let tag = adr >> this.numberOfAddressBits
    let index = adr & this.andMask
    let line = null
    //console.log('DEBUG ' + this.name + ' tag=' + tag + ', index=' + index)

    // check, if cache line is already in cache
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ' write cache miss :-(')
      lineNum = this.findInvalidLine()
      if(lineNum == null) {
        //console.log('DEBUG ' + this.name + ' and cache is full :-( :-(')
        lineNum = this.evictOldestLine();
      } else {
        //console.log('DEBUG' + this.name + ' but cache is not full :-|')
      }
	  //line = this.cacheLines[lineNum];
      this.setTag(lineNum, tag)
      let values = this.bus.placeWriteMiss(this, tag, this.numberOfAddressBits)
	  this.setValues(lineNum, values)      
    } else {
      //console.log('DEBUG ' + this.name + ' write cache hit :-)')
	  // only notify other caches if this cache does not already own the cache line
	  if(this.getState(lineNum) == States.SHARED) { // not already modified and not exclusive
        this.bus.placeInvalidate(this, tag, this.numberOfAddressBits)
	  }
      //line = this.cacheLines[lineNum];
    }
    
    //console.log('DEBUG ' + this.name + ' write value to cache line #' + lineNum)   
	this.setState(lineNum, States.MODIFIED)
	this.setValue(lineNum, index, value)
    return  
  }	
	
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // reading cache: invalid -> shared
  // this cache:
  //   not in cache: do nothing
  //   exclusive:    change state to shared
  //   shared:       do nothing (maybe share cache line values)
  //   modified:     write back to memory (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopReadMiss(tag) {
    console.log('DEBUG ' + this.name + '.snoopReadMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      console.log('DEBUG ' + this.name + ': found in this cache')
      let values = this.getValues(lineNum)
	  switch(this.getState(lineNum)) {
		case States.EXCLUSIVE:
		  this.setState(lineNum, States.SHARED)
		  break
		case States.MODIFIED:
		  this.setState(lineNum, States.OWNED)
		  break
      }
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // writing cache: invalid -> modified
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid (and maybe share cache line values)
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values)
  // returns cache line values, if exist in this cache
  snoopWriteMiss(tag) {
    //console.log('DEBUG ' + this.name + '.snoopWriteMiss(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
      return null
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
	  let values = this.getValues(lineNum)
      // no write back is necessary, because cache line moves from this cache to writing cache
      //if(line.state == States.MODIFIED) {
      //  console.log('DEBUG ' + this.name + ': and is modified, so write back to memory')
      //  this.bus.placeWriteBack(tag, this.numberOfAddressBits, line.values)
      //}
	  
	  this.setState(lineNum, States.INVALID)
      return values
    }
  }
  
  // !!!!!!!!!!!!!spannend!!!!!!!!!!!!!!!!!!!
  // also nkown as snoop invalidate
  // writing cache: shared -> modified
  // it is nearly the same as snoopWriteMiss, except there is no return value
  // this cache:
  //   not in cache: do nothing
  //   shared:       change state to invalid
  //   modified:     write back to memory and change state to invalid (and maybe share cache line values?)
  // returns nothing
  snoopInvalidate(tag) {
    //console.log('DEBUG ' + this.name + '.snoopInvalidate(tag=' + tag + ')')
    let lineNum = this.lineInCache(tag)
    if(lineNum == null) {
      //console.log('DEBUG ' + this.name + ': not in this cache')
    } else {
      //console.log('DEBUG ' + this.name + ': found in this cache')
      if(this.getState(lineNum) == States.MODIFIED) {
		//console.log('DEBUG ' + this.name + ': and is modified, so write back to memory')
		let values = this.getValues(lineNum)
        this.bus.placeWriteBack(tag, this.numberOfAddressBits, values)
      }
	  this.setState(lineNum, States.INVALID)
    }
  }
  
  snoopWriteBack(tag) {
	// do nothing
  }
}

class AbstractSystem {
  constructor(memorySize, numberOfCpus)	{
	console.log('DEBUG AbstractSystem.constructor(memorySize=' + memorySize + ', numberOfCpus=' + numberOfCpus + ')')
	this.clock = new Clock()
    this.clock.reset()
    this.memory = new Memory(memorySize)
    this.bus = new Bus()
    this.bus.connectClock(this.clock)
	this.cpus = new Array(numberOfCpus)
    for(let i = 0; i < numberOfCpus; i++) {
	  this.cpus[i] = new Cpu('cpu' + i)
	}
	this.bus.connectMemory(this.memory)
  }
}

class SystemNoCaches extends AbstractSystem {
  constructor(memorySize, numberOfCpus) {
	console.log('DEBUG SystemNoCaches.constructor()')
	super(memorySize, numberOfCpus)
	// Die CPUs direkt mit dem Bus verbinden
    for(let i = 0; i < numberOfCpus; i++) {
      this.cpus[i].connect(this.bus)
	}
  }
}

class SystemWithCaches extends AbstractSystem {
  constructor(memorySize, numberOfCpus, cacheProtocol, numberOfCacheLines, offsetBits) {
	console.log('DEBUG SystemWithCaches.constructor()')
	super(memorySize, numberOfCpus)
	this.caches = new Array(numberOfCpus)
	for(let i = 0; i < numberOfCpus; i++) {
      switch(cacheProtocol) {
        case CacheProtocols.VI:
          this.caches[i] = new CacheVI('cache #' + i, numberOfCacheLines, offsetBits);
		  break
        case CacheProtocols.MSI:
          this.caches[i] = new CacheMSI('cache #' + i, numberOfCacheLines, offsetBits);
		  break
	    case CacheProtocols.MESI:
          this.caches[i] = new CacheMESI('cache #' + i, numberOfCacheLines, offsetBits);
	      break
	    case CacheProtocols.MOSI:
          this.caches[i] = new CacheMOSI('cache #' + i, numberOfCacheLines, offsetBits);
	      break		  
	    case CacheProtocols.MOESI:
          this.caches[i] = new CacheMOESI('cache #' + i, numberOfCacheLines, offsetBits);
	      break
	    default:
          console.error('ERROR unknown protocol: ' + cacheProtocol)
      } 
	  this.caches[i].connectBus(this.bus)
	  this.caches[i].connectClock(this.clock)
	  console.log('DEBUG SystemWithCaches.constructor: cpus[' + i + '].connect(' + this.caches[i] + ')')
	  this.cpus[i].connect(this.caches[i])
    }
	this.bus.connectCaches(this.caches)
  }
}