<template>
  <div style="text-align:left; padding: 20px">
    <h1>
      Scan address
    </h1><span style="font-size:14px; font-weight:normal; margin-top:-40px">{{ $route.params.address }}</span><br><br>
    <div v-if="written.length > 0">
      <div class="columns is-multiline is-mobile">
        <div class="column is-one-quarter" v-for="file in written" v-bind:key="file.uuid">
          <div class="card">
            <div class="card-content">
              <div class="media">
                <div class="media-content">
                  <p class="title is-4">{{ file.data.message.title }}</p>
                  <p class="subtitle is-6">{{ file.uuid }}</p>
                </div>
              </div>

              <div class="content">
                <b>Notarize at block</b> {{ file.block }}<br>
                <b>At</b> {{ file.date }}<br><br>
                <a :href="file.link" target="_blank">
                  <b-button style="width:100%" type="is-info">DOWNLOAD CERTIFICATE</b-button>
                </a>
                <b-button style="width:100%" v-if="!isInvalidating" v-on:click="invalidate(file.uuid)" type="is-danger">INVALIDATE CERTIFICATE</b-button>
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
        isLogging: true,
        file: [],
        written: [],
        userwallet: {},
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
        let written = await app.scrypta.post('/read', {address: app.scan, protocol: process.env.VUE_APP_do_space + '://'})
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
          if(check !== false && signed.address === process.env.VUE_APP_master_address){
            try{
              data.link = 'https://' + process.env.VUE_APP_do_space + '.' + process.env.VUE_APP_do_endpoint + '/' + app.scan + '/' + signed.message.file
              let file = await axios.get(data.link, {responseType: 'arraybuffer'})
              data.filetype = await FileType.fromBuffer(file.data)
              if(data.data.message.title !== '' && data.data.message.title !== undefined){
                data.data.message.title = LZUTF8.decompress(data.data.message.title, { inputEncoding: 'Base64' })
              }
              data.date = timestampToDate(data.data.message.timestamp,'dd/MM/yyyy HH:mm:ss')
              app.written.push(data)
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
                let do_key = await app.scrypta.decryptData(process.env.VUE_APP_do_key_id, key.prv)
                let do_secret = await app.scrypta.decryptData(process.env.VUE_APP_do_secret_key, key.prv)
                aws.config.update({
                  accessKeyId: do_key,
                  secretAccessKey: do_secret
                })
                const spacesEndpoint = new aws.Endpoint(process.env.VUE_APP_do_endpoint);
                const s3 = new aws.S3({
                  endpoint: spacesEndpoint
                })
                s3.getObject({Bucket: process.env.VUE_APP_do_space, Key: 'db'}, async function(err, data) {
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
      async invalidate(uuid){
        const app = this
        let unlock = await app.loadDbfromSpace()
        if(unlock !== false){
          app.isInvalidating = true
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
                  app.$buefy.toast.open({
                    message: "Data invalidated correctly, please wait at least 2 minutes!",
                    type: "is-success"
                  })
                  app.isInvalidating = false
                  app.userwallet = ''
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
