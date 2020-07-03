<template>
  <div style="text-align:left; padding: 20px">
    <h1>
      Registered users
      <b-button style="float:right" type="is-primary" size="is-small" v-on:click="showCreateModal">NEW</b-button>
    </h1><br>
    <b-table :data="db">
      <template slot-scope="props">
        <b-table-column field="address" label="Lyra address">
          {{ props.row.address }}
        </b-table-column>
        <b-table-column field="name" label="Name">
          {{ props.row.name }}
        </b-table-column>
        <b-table-column field="surname" label="Surname">
          {{ props.row.surname }}
        </b-table-column>
        <b-table-column field="email" label="E-Mail">
          {{ props.row.email }}
        </b-table-column>
        <b-table-column field="pin" label="PIN">
          {{ props.row.pin }}
        </b-table-column>
        <b-table-column field="actions" label="Actions" width="150">
          <b-button v-on:click="showEditModal(props.index)" type="is-primary" style="margin: 0 2px" size="is-small">EDIT</b-button>
          <a target="_blank" :href="'/#/scan/'+props.row.address"><b-button type="is-success" style="margin: 0 2px" size="is-small">SCAN</b-button></a>
        </b-table-column>
      </template>
    </b-table>
    <b-modal :active.sync="showCreate" has-modal-card trap-focus :destroy-on-hide="true" aria-role="dialog" aria-modal>
      <div class="modal-card" style="width: auto">
        <header class="modal-card-head">
            <p class="modal-card-title">New user</p>
        </header>
        <section class="modal-card-body">
          <b-field label="Name">
              <b-input
                  type="text"
                  v-model="user.name"
                  required>
              </b-input>
          </b-field>
          <b-field label="Surname">
              <b-input
                  type="text"
                  v-model="user.surname"
                  required>
              </b-input>
          </b-field>
          <b-field label="PIN">
              <b-input
                  type="text"
                  v-model="user.pin"
                  required>
              </b-input>
          </b-field>
          <b-field label="E-Mail">
              <b-input
                  type="text"
                  v-model="user.email"
                  required>
              </b-input>
          </b-field>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-primary" v-on:click="create" style="width:100%">CREATE</button>
        </footer>
      </div>
    </b-modal>
    <b-modal :active.sync="showEdit" has-modal-card trap-focus :destroy-on-hide="true" aria-role="dialog" aria-modal>
      <div class="modal-card" style="width: auto">
        <header class="modal-card-head">
            <p class="modal-card-title">Edit user</p>
        </header>
        <vue-qrcode v-if="qrvisible" :value="user.sid" />
        <section v-if="!qrvisible" class="modal-card-body">
          <b-field label="Name">
              <b-input
                  type="text"
                  v-model="user.name"
                  required>
              </b-input>
          </b-field>
          <b-field label="Surname">
              <b-input
                  type="text"
                  v-model="user.surname"
                  required>
              </b-input>
          </b-field>
          <b-field label="PIN">
              <b-input
                  type="text"
                  v-model="user.pin"
                  required>
              </b-input>
          </b-field>
          <b-field label="E-Mail">
              <b-input
                  type="text"
                  v-model="user.email"
                  required>
              </b-input>
          </b-field>
        </section>
        <div style="padding:0px 20px 20px 20px; background:#fff">
          <button class="button is-success" v-on:click="showQR" v-if="!qrvisible" style="width:100%">SHOW QR</button>
          <button class="button is-success" v-on:click="hideQR" v-if="qrvisible" style="width:100%">HIDE QR</button>
        </div>
        <footer class="modal-card-foot">
          <button class="button is-primary" v-on:click="edit" style="width:100%">EDIT</button>
          <button class="button is-danger" v-on:click="remove" style="width:100%">DELETE</button>
        </footer>
      </div>
    </b-modal>
  </div>
</template>

<script>
  let ScryptaCore = require("@scrypta/core")
  const aws = require('aws-sdk')
  import VueQrcode from 'vue-qrcode'

  export default {
    components: {
      VueQrcode
    },
    data() {
      return {
        scrypta: new ScryptaCore(true),
        address: "",
        wallet: "",
        isLogging: true,
        file: [],
        user: {
          name: '',
          surname: '',
          pin: '',
          email: ''
        },
        toedit: '',
        oldpin: '',
        db: [],
        isUploading: false,
        showCreate: false,
        isUpdating: false,
        showEdit: false,
        qrvisible: false
      };
    },
    async mounted() {
      const app = this;
      app.wallet = await app.scrypta.importBrowserSID();
      app.wallet = await app.scrypta.returnDefaultIdentity();
      if (app.wallet.length > 0) {
        let SIDS = app.wallet.split(":");
        app.address = SIDS[0];
        let identity = await app.scrypta.returnIdentity(app.address);
        app.wallet = identity;
        app.isLogging = false;
        app.loadDbfromSpace()
      } else {
        app.isLogging = false;
      }
    },
    methods: {
      showQR(){
        this.qrvisible = true
      },
      hideQR(){
        this.qrvisible = false
      },
      showCreateModal(){
        const app = this
        app.showCreate = true
        app.user = {
          name: '',
          surname: '',
          pin: '',
          email: ''
        }
      },
      showEditModal(key){
        const app = this
        app.toedit = key
        app.user = app.db[key]
        app.oldpin = app.user.pin
        app.showEdit = true
      },
      loadDbfromSpace() {
        const app = this
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
                    }else{
                      app.$buefy.toast.open({
                        message: "Wrong wallet!",
                        type: "is-danger"
                      });
                    }
                  }else{
                    // CREATE DB
                    let crypted = await app.scrypta.cryptData('[]', key.prv)
                    s3.upload({
                        Bucket: process.env.VUE_APP_do_space,
                        ACL: 'private',
                        Body: Buffer(crypted),
                        Key: 'db'
                    }, { Bucket: process.env.do_space }, function (err) {
                        app.isUploading = false
                        if(!err){
                          app.db = []
                          app.$buefy.toast.open({
                            message: "DB was created successfully!",
                            type: "is-success"
                          });
                        }else{
                          app.$buefy.toast.open({
                            message: "Something goes wrong with Space!",
                            type: "is-danger"
                          });
                        }
                    })
                  }
                });
              } else {
                app.$buefy.toast.open({
                  message: "Wrong password!",
                  type: "is-danger"
                });
                location.reload()
              }
            }
          });
      },
      syncDbToSpace(){
        const app = this
        return new Promise(response => {
          app.$buefy.dialog.prompt({
            message: `Enter wallet password`,
            inputAttrs: {
              type: "password"
            },
            trapFocus: true,
            onConfirm: async password => {
              let key = await app.scrypta.readKey(password, app.wallet.wallet);
              if (key !== false) {
                const spacesEndpoint = new aws.Endpoint(process.env.VUE_APP_do_endpoint);
                const s3 = new aws.S3({
                  endpoint: spacesEndpoint
                })
                let crypted = await app.scrypta.cryptData(JSON.stringify(app.db), key.prv)
                s3.upload({
                    Bucket: process.env.VUE_APP_do_space,
                    ACL: 'private',
                    Body: Buffer(crypted),
                    Key: 'db'
                }, { Bucket: process.env.do_space }, function (err) {
                    app.isUploading = false
                    response(true)
                    if(err){
                      app.$buefy.toast.open({
                        message: "Something goes wrong with Space!",
                        type: "is-danger"
                      });
                    }
                })
              } else {
                app.$buefy.toast.open({
                  message: "Wrong password!",
                  type: "is-danger"
                });
              }
            }
          });
        })
      },
      async edit(){
        const app = this
        if(app.user.name !== '' && app.user.surname !== '' && app.user.email !== '' && app.user.pin !== ''){
          if(app.user.pin !== app.oldpin){
            let check = await app.scrypta.readKey(app.oldpin, app.user.sid)
            var wallet = {
                prv: check.prv,
                key: check.key
            }
            let newsid = await app.scrypta.buildWallet(app.user.pin, check.pub, wallet, false)
            let doublecheck = await app.scrypta.readKey(app.user.pin, newsid)
            if(doublecheck !== false){
              app.user.sid = newsid
            }else{
              app.user.pin = app.user.oldpin
              app.$buefy.toast.open({
                message: "Something goes wrong with PIN change, reverting.",
                type: "is-danger"
              })
            }
          }
          app.db[app.toedit] = app.user
          app.syncDbToSpace()
        }
      },
      async remove(){
        const app = this
        this.$buefy.dialog.confirm({
            title: 'Deleting account',
            message: 'Are you sure you want to <b>delete</b> '+app.user.name+'\'s account? This action cannot be undone.',
            confirmText: 'Delete Account',
            type: 'is-danger',
            onConfirm: async () => {
              let updated = []
              for(let x in app.db){
                if(parseFloat(x) !== parseFloat(app.toedit)){
                  updated.push(app.db[x])
                }
              }
              app.db = updated
              await app.syncDbToSpace()
              this.$buefy.toast.open('Account deleted!')
            }
        })
        app.showEdit = false
      },
      async create(){
        const app = this
        if(app.user.name !== '' && app.user.surname !== '' && app.user.email !== '' && app.user.pin !== ''){
          let newaddress = await app.scrypta.createAddress(app.user.pin, false)
          let check = await app.scrypta.readKey(app.user.pin, newaddress.walletstore)
          if(check !== false){
            app.user.sid = newaddress.walletstore
            app.user.address = newaddress.pub
            app.db.push(app.user)
            await app.syncDbToSpace()
            app.user = {
              name: '',
              surname: '',
              pin: '',
              email: ''
            }
            app.showCreate = false
          }else{
            app.$buefy.toast.open({
              message: "Something goes wrong with Wallet, please change PIN.",
              type: "is-danger"
            });
          }
        }else{
          app.$buefy.toast.open({
            message: "Fill all the fields first!",
            type: "is-danger"
          });
        }
      }
    }
  };
</script>
