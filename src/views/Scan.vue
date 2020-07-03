<template>
  <div style="text-align:left; padding: 20px">
    <div v-if="isUnlocked">
      <h1>
        Scan folder
      </h1><span style="font-size:14px; font-weight:normal; margin-top:-40px">{{ $route.params.address }}</span><br><br>
      <div v-if="written.length > 0">
        <div class="columns is-multiline is-mobile">
          <div class="column is-one-quarter" v-for="file in written" v-bind:key="file.uuid">
            <div class="card">
              <div class="card-content">
                <div class="media">
                  <div class="media-content">
                    <p v-if="file.data.message.title" class="title is-4">{{ file.data.message.title }}</p>
                    <p v-if="!file.data.message.title" class="title is-4">Untitled</p>
                  </div>
                </div>
                <div class="content">
                  <b>Hash file:</b> {{ file.data.message.file.substr(0,6) }}...{{ file.data.message.file.substr(-6) }}<br>
                  <b>Notarized at block</b> {{ file.block }}<br>
                  <b>At</b> {{ file.date }}<br><br>
                  <a :href="file.link" v-if="!file.data.message.visibility || file.data.message.visibility === 'public'">
                    <b-button style="width:100%" type="is-info">DOWNLOAD</b-button>
                  </a>
                  <b-button style="width:100%"  v-if="file.data.message.visibility && file.data.message.visibility === 'encrypted'" v-on:click="decrypt(file.uuid)" type="is-info">DECRYPT AND DOWNLOAD</b-button>
                  <b-button style="width:100%" v-if="!isInvalidating" v-on:click="invalidate(file.uuid)" type="is-danger">INVALIDATE</b-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="written.length === 0">
        Nessun file da mostrare...
      </div>
    </div>
    <div v-if="!isUnlocked" style="padding:20vh 0; text-align:center;">
      Unlock your wallet first.<br><br>
      <b-button v-on:click="loadDbfromSpace" type="is-primary">UNLOCK</b-button>
    </div>
  </div>  
</template>

<script>
  let ScryptaCore = require("@scrypta/core")
  const axios = require('axios')
  const FileType = require('file-type/browser')
  const LZUTF8 = require('lzutf8')
  const timestampToDate = require('timestamp-to-date')
  const aws = require('aws-sdk')

  export default {
    data() {
      return {
        scrypta: new ScryptaCore(true),
        address: "",
        wallet: "",
        isUnlocked: false,
        isLogging: true,
        written: [],
        files: [],
        userwallet: {},
        s3filekeys: {},
        scan: '',
        user: {
          name: '',
          surname: '',
          pin: '',
          email: ''
        },
        toedit: '',
        oldpin: '',
        db: [],
        isInvalidating: false
      }
    },
    async mounted() {
      const app = this
      app.wallet = await app.scrypta.importBrowserSID()
      app.wallet = await app.scrypta.returnDefaultIdentity()
      if (app.wallet.length > 0) {
        let SIDS = app.wallet.split(":")
        app.address = SIDS[0]
        let identity = await app.scrypta.returnIdentity(app.address)
        app.wallet = identity
        app.isLogging = false
        app.scan = app.$route.params.address
        let written = await app.scrypta.post('/read', {address: app.scan, protocol: 'register://'})
        await app.loadDbfromSpace()
        app.scanWritten(written)
      } else {
        app.isLogging = false
      }
    },
    methods: {
      async scanWritten(written){
        const app = this
        for(let i in written.data){
          let data = written.data[i]
          data.data.message = JSON.parse(data.data.message)
          let signed = data.data
          let check = await app.scrypta.verifyMessage(signed.pubKey, signed.signature, JSON.stringify(signed.message))
          if(check !== false && signed.address === app.address){
            try{
              app.s3filekeys[data.uuid] = app.scan + '/' + signed.message.file
              data.link = 'https://' + app.digitalocean.space + '.' + app.digitalocean.endpoint + '/scryptaregister/' + app.scan + '/' + signed.message.file
              let file = await axios.get(data.link, {responseType: 'arraybuffer'})
              data.filetype = await FileType.fromBuffer(file.data)
              if(data.data.message.title !== '' && data.data.message.title !== undefined){
                data.data.message.title = LZUTF8.decompress(data.data.message.title, { inputEncoding: 'Base64' })
              }
              data.date = timestampToDate(data.data.message.timestamp,'dd/MM/yyyy HH:mm:ss')
              app.written.push(data)
              app.files[data.uuid] = data
            }catch(e){
              alert(e)
            }
          }
        }
      },
      loadDbfromSpace() {
        const app = this
        return new Promise( response => {
          app.$buefy.dialog.prompt({
            message: `Enter wallet password`,
            inputAttrs: {
              type: "password"
            },
            trapFocus: true,
            onConfirm: async password => {
              let key = await app.scrypta.readKey(password, app.wallet.wallet);
              if (key !== false) {
                aws.config.update({
                  accessKeyId: key.do.key_id,
                  secretAccessKey: key.do.key_secret
                })
                app.isUnlocked = true
                app.digitalocean = key.do
                const spacesEndpoint = new aws.Endpoint(key.do.endpoint)
                const s3 = new aws.S3({
                  endpoint: spacesEndpoint
                })
                s3.getObject({Bucket: key.do.space, Key: 'scryptaregister/' + app.address + '.db'}, async function(err, data) {
                  if(!err){
                    let db = new Buffer.from(data.Body).toString()
                    let decrypted = await app.scrypta.decryptData(db, key.prv)
                    if(decrypted !== false){
                      app.db = JSON.parse(decrypted)
                      for(let k in app.db){
                        if(app.db[k].address === app.scan){
                          app.userwallet = {pin: app.db[k].pin, sid: app.db[k].sid}
                        }
                      }
                      response(password)
                    }else{
                      app.$buefy.toast.open({
                        message: "Wrong wallet!",
                        type: "is-danger"
                      })
                      response(false)
                    }
                  }
                });
              } else {
                app.$buefy.toast.open({
                  message: "Wrong password!",
                  type: "is-danger"
                })
                response(false)
              }
            }
          });
        })
      },
      async decrypt(uuid){
        const app = this
        let encrypted = await axios.get('https://'+app.digitalocean.space+'.'+app.digitalocean.endpoint+'/scryptaregister/' + app.scan + '/' + app.files[uuid].data.message.file)
        let userwallet = await app.scrypta.readKey(app.userwallet.pin, app.userwallet.sid)
        let decrypted = await app.scrypta.decryptFile(encrypted.data, userwallet.prv, true)
        if(decrypted !== false){
          let ft = await FileType.fromBuffer(decrypted)
          let blob = new Blob([decrypted], { type: ft.mime })
          var blobUrl = URL.createObjectURL(blob)
          const app = this
          var a = document.createElement("a");
          document.body.appendChild(a);
          a.style = "display: none";
          a.href = blobUrl;
          let title = app.files[uuid].data.message.title
          if(title === ''){
            title = 'Untitled.' + ft.ext
          }
          a.download = title;
          a.click();
        }else{
          app.$buefy.toast.open({
            message: "Something goes wrong with decryption.",
            type: "is-error"
          })
        }
      },
      async invalidate(uuid){
        const app = this
        let unlock = await app.loadDbfromSpace()
        if(unlock !== false){
          app.isInvalidating = true
          app.$buefy.toast.open({
            message: "Invalidating please wait..",
            type: "is-info"
          })
          let balance = await app.scrypta.get('/balance/' + app.wallet.address)
          if(balance.balance >= 0.002){
            let funded = false
            while(funded === false){
              let sent = await app.scrypta.send(app.wallet.wallet, unlock, app.scan, 0.002) 
              if(sent !== false && sent !== null && sent.length > 1){
                funded = true
              }
            }
            if(funded === true){

              let success = false
              let written

              while(success === false){
                written = await app.scrypta.invalidate(app.userwallet.sid, app.userwallet.pin, uuid)
                if (written.txs.length >= 1 && written.txs[0] !== null) {
                  success = true
                  const spacesEndpoint = new aws.Endpoint(app.digitalocean.endpoint);
                  const s3 = new aws.S3({
                    endpoint: spacesEndpoint
                  })
                  s3.deleteObject({Bucket: app.digitalocean.space, Key: 'scryptaregister/' + app.s3filekeys[uuid]}, async function(err) {
                    if(!err){
                      app.$buefy.toast.open({
                        message: "Data invalidated and deleted from space correctly, please wait at least 2 minutes!",
                        type: "is-success"
                      })
                      app.isInvalidating = false
                      app.userwallet = ''
                    }
                  })
                }
              }
            }else{
              app.$buefy.toast.open({
                message: "There's something wrong with the funding operation, please retry.",
                type: "is-danger"
              })
            }
          }else{
            app.$buefy.toast.open({
              message: "Not enough balance, please fund your address.",
              type: "is-danger"
            })
            app.isWriting = false
          }
        }
      }
    }
  }
</script>
