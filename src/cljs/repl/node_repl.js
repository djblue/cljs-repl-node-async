/**
 * Copyright (c) Rich Hickey. All rights reserved.
 * The use and distribution terms for this software are covered by the
 * Eclipse Public License 1.0 (http://opensource.org/licenses/eclipse-1.0.php)
 * which can be found in the file epl-v10.html at the root of this distribution.
 * By using this software in any fashion, you are agreeing to be bound by
 * the terms of this license.
 * You must not remove this notice, or any other, from this software.
 */

process.env.NODE_DISABLE_COLORS = true
var net = require('net')
var vm = require('vm')
var dom = require('domain').create()
var PORT = process.env.PORT || 5001
var repl = null

try {
  require('source-map-support').install()
} catch (err) {
}

function isPromise (value) {
  return value !== undefined && value !== null && typeof value.then === 'function'
}

function toString (value) {
  if (value === undefined || value === null) {
    return null
  }

  if (global.cljs !== undefined) {
    return cljs.core.pr_str.call(null, value)
  }

  return value.toString()
}

var server = net.createServer(function (socket) {
  socket.write('ready')
  socket.write('\0')

  socket.setEncoding('utf8')

  process.stdout.write = function (chunk, encoding, fd) {
    var args = Array.prototype.slice.call(arguments, 0)
    args[0] = JSON.stringify({ type: 'out', repl: repl, value: chunk })
    socket.write.apply(socket, args)
    socket.write('\0')
  }

  process.stderr.write = (function (write) {
    return function (chunk, encoding, fd) {
      var args = Array.prototype.slice.call(arguments, 0)
      args[0] = JSON.stringify({ type: 'err', repl: repl, value: chunk })
      socket.write.apply(socket, args)
      socket.write('\0')
    }
  })(process.stderr.write)

  dom.on('error', function (ue) {
    console.error(ue.stack)
  })


  var buffer = ''

  socket.on('data', function (data) {
    if (data[data.length - 1] != '\0') {
      buffer += data
      return
    }

    if (buffer.length > 0) {
      data = buffer + data
      buffer = ''
    }

    if (!data) {
      return
    }

    // not sure how \0's are getting through - David
    data = data.replace(/\0/g, '')

    if (data == ':cljs/quit') {
      server.close()
      socket.unref()
      return
    }

    var ret = null
    var err = null

    try {
      dom.run(function () {
        var obj = JSON.parse(data)
        repl = obj.repl
        ret = vm.runInThisContext(obj.form, 'repl')
      })
    } catch (e) {
      err = e
    }

    function write (status, value) {
      var message = {
        type: 'result',
        repl: repl,
        status: status,
        value: value
      }
      socket.write(JSON.stringify(message))
      socket.write('\0')
    }

    if (err) {
      write('exception', cljs.repl.error__GT_str(err))
    } else if (isPromise(ret)) {
      ret.then(function (ret) {
        write('success', '#object[Promise ' + toString(ret) + ']')
      }).catch(function (err) {
        write('exception', '#object[Promise ' + cljs.repl.error__GT_str(err) + ']')
      })
    } else {
      write('success', toString(ret))
    }
  })
}).listen(PORT)
