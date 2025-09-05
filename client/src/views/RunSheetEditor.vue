<template>
  <div>
    <NavBar :me="me" @logout="logout" />

    <div class="rs container">
      <!-- Header -->
      <div class="panel header">
        <input v-model="rs.title" class="input input--title" placeholder="Runsheet title" />

        <div class="field">
          <label class="label" for="rs-date">Runsheet Date</label>
          <input id="rs-date" type="date" v-model="dateStr" class="input input--date" />
        </div>

        <div class="field">
          <label class="label" for="pickup-date">Pickup Date</label>
          <input id="pickup-date" type="date" v-model="pickupStr" class="input input--date" />
        </div>

        <div class="field">
          <label class="label" for="return-date">Return Date</label>
          <input id="return-date" type="date" v-model="returnStr" class="input input--date" />
        </div>

        <div class="field">
          <label class="label" for="rs-status">Status</label>
          <select id="rs-status" v-model="rs.status" class="select">
            <option>draft</option>
            <option>open</option>
            <option>assigned</option>
            <option>claimed</option>
            <option>in_progress</option>
            <option>completed</option>
            <option>cancelled</option>
          </select>
        </div>

        <div class="header__actions">
          <button type="button" class="btn" @click.stop.prevent="goToRunsheetView" :disabled="!rs._id">View</button>
          <button type="button" class="btn btn--primary" @click.stop.prevent="save" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>

        <span class="muted saved" v-if="savedAt">Saved {{ savedAt }}</span>
      </div>

      <!-- Type -->
      <section class="panel">
        <h3 class="subtitle">Type</h3>
        <div class="row row--wrap">
          <div class="field">
            <div class="label">Purchase Type</div>
            <label class="radio">
              <input type="radio" value="purchase" v-model="rs.purchaseType" /> Purchase
            </label>
            <label class="radio">
              <input type="radio" value="rental" v-model="rs.purchaseType" /> Rental
            </label>
          </div>
        </div>
        <p class="muted">
          If this is a rental, ensure both Pickup and Return dates are set (Return can’t be before Pickup).
        </p>
      </section>

      <!-- Destination (Take To) -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Destination (Take To)</h3>
          <div class="muted">Choose the final drop-off location from your saved Places.</div>
        </div>

        <div class="row row--tight">
          <div class="field w-full">
            <div class="label">Select Place</div>
            <PlaceSearch @select="setTakeTo" />
            <p v-if="rs.takeTo" class="muted mt-1">
              Selected: <strong>{{ rs.takeTo?.name }}</strong>
              <span v-if="rs.takeTo?.address"> — {{ rs.takeTo.address }}</span>
              <button type="button" class="chip chip--x" @click.stop.prevent="clearTakeTo">×</button>
            </p>
          </div>
        </div>
      </section>

      <!-- Set -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Set</h3>
        </div>

        <div class="row row--tight">
          <input v-model="setSearch" placeholder="Search sets…" />
          <button class="btn" @click="searchSets">Search</button>

          <div class="muted" v-if="rs.set">
            Current: <strong>{{ currentSetLabel }}</strong>
          </div>
        </div>

        <div class="pillbar">
          <button
            v-for="s in setResults"
            :key="s._id"
            class="pill"
            @click="chooseSet(s)"
          >Use {{ s.number }} — {{ s.name }}</button>

          <button class="pill" v-if="rs.set" @click="clearSet">Clear Set</button>
        </div>
      </section>

      <!-- Primary Contact (People) – single-select checkbox -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Primary Contact</h3>
          <div class="muted">Select exactly one person to be the contact for this runsheet.</div>
        </div>

        <div v-if="peopleError" class="error">{{ peopleError }}</div>
        <div v-else-if="!people.length" class="muted">No people found.</div>

        <ul class="selectlist" v-else>
          <li v-for="p in people" :key="p._id" class="selectlist__item">
            <label class="selectlist__row">
              <!-- Checkbox that behaves like a radio -->
              <input
                type="checkbox"
                :checked="selectedPersonId === p._id"
                @change="onTogglePerson(p, $event)"
              />
              <div class="selectlist__meta">
                <div class="selectlist__title">
                  {{ p.name }}
                </div>
                <div class="selectlist__sub muted">
                  <span v-if="p.email">{{ p.email }}</span>
                  <span v-if="p.email && p.phone"> · </span>
                  <span v-if="p.phone">{{ p.phone }}</span>
                </div>
              </div>
            </label>
          </li>
        </ul>

        <div class="row row--tight">
          <button class="btn" v-if="selectedPersonId" @click="clearContact" :disabled="contactSaving">Clear selection</button>
          <span class="muted" v-if="contactSaving">Saving…</span>
        </div>

        <p class="muted" v-if="selectedPersonLabel">
          Selected: <strong>{{ selectedPersonLabel }}</strong>
        </p>
      </section>

      <!-- Photos -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Photos</h3>
          <input type="file" multiple @change="uploadPhotos" />
        </div>

        <div class="thumbs">
          <div v-for="p in rs.photos" :key="p" class="thumb">
            <img :src="imageUrl(p)" class="thumb__img" />
            <button type="button" class="chip chip--x" @click.stop.prevent="removePhoto(p)">×</button>
          </div>
          <div v-if="!rs.photos?.length" class="empty muted">No photos yet.</div>
        </div>
      </section>

      <!-- Receipts -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Receipts</h3>
          <input type="file" multiple accept="image/*,application/pdf" @change="uploadReceipts" />
        </div>

        <div class="thumbs">
          <div v-for="r in rs.receipts" :key="r" class="thumb">
            <img v-if="isImage(r)" :src="imageUrl(r)" class="thumb__img" />
            <a v-else :href="imageUrl(r)" target="_blank" rel="noopener" class="link link--small">Open receipt</a>
            <button type="button" class="chip chip--x" @click.stop.prevent="removeReceipt(r)">×</button>
          </div>
          <div v-if="!rs.receipts?.length" class="empty muted">No receipts yet.</div>
        </div>
      </section>

      <!-- Post-Run Destination (one-of checkboxes) -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Post-Run Destination</h3>
          <div class="muted">Choose one destination for items after the run.</div>
        </div>

        <div class="row row--tight">
          <label class="checkbox">
            <input
              type="checkbox"
              :checked="rs.postLocation === 'hold_on_truck'"
              @change="togglePost('hold_on_truck', $event)"
            />
            Hold On Truck
          </label>

          <label class="checkbox">
            <input
              type="checkbox"
              :checked="rs.postLocation === 'office'"
              @change="togglePost('office', $event)"
            />
            Office
          </label>

          <label class="checkbox">
            <input
              type="checkbox"
              :checked="rs.postLocation === 'setdec_storage'"
              @change="togglePost('setdec_storage', $event)"
            />
            Set Dec Storage
          </label>

          <label class="checkbox">
            <input
              type="checkbox"
              :checked="rs.postLocation === 'address_below'"
              @change="togglePost('address_below', $event)"
            />
            Address Below
          </label>
        </div>

        <!-- When Address Below is selected, show place search & current selection -->
        <div v-if="rs.postLocation === 'address_below'" class="mt-2">
          <PlaceSearch @select="choosePostPlace" />
          <p v-if="postPlaceLabel" class="muted mt-1">
            Selected: <strong>{{ postPlaceLabel }}</strong>
            <button type="button" class="chip chip--x" @click="clearPostPlace">×</button>
          </p>

          <div class="field">
            <label class="label" for="post-addr">Address</label>
            <textarea
              id="post-addr"
              v-model="rs.postAddress"
              rows="2"
              placeholder="Enter the address for this option"
              @change="savePostLocation"
            ></textarea>
            <p class="muted">Required when “Address Below” is selected (or choose a Place above).</p>
          </div>
        </div>
      </section>

      <!-- Purchase / Payment -->
<section class="panel">
  <div class="row">
    <h3 class="subtitle">Purchase / Payment</h3>
    <div class="muted">Record invoice, deposit, PO and payment details.</div>
  </div>

  <div class="row row--tight">
    <label class="checkbox">
      <input type="checkbox" v-model="rs.getInvoice" @change="savePurchase" />
      Get Invoice
    </label>

    <label class="checkbox">
      <input type="checkbox" v-model="rs.getDeposit" @change="savePurchase" />
      Get Deposit
    </label>

    <label class="checkbox">
      <input type="checkbox" v-model="rs.paid" @change="savePurchase" />
      Paid
    </label>
  </div>

  <div class="row row--wrap">
    <div class="field">
      <label class="label">Cheque #</label>
      <input v-model="rs.chequeNumber" @change="savePurchase" />
    </div>

    <div class="field">
      <label class="label">PO #</label>
      <input v-model="rs.poNumber" @change="savePurchase" />
    </div>

    <div class="field">
      <label class="label">Amount</label>
      <input
        type="number"
        min="0"
        step="0.01"
        v-model.number="rs.amount"
        @change="savePurchase"
      />
    </div>

    <div class="field">
      <label class="label">Cheque/Cash Rec By</label>
      <input
        v-model="rs.paymentReceivedBy"
        placeholder="Name"
        @change="savePurchase"
      />
    </div>
  </div>
</section>

      <!-- Stops -->
      <section class="panel">
        <div class="row">
          <h3 class="subtitle">Stops</h3>
          <div class="muted">Use Add below, then Move Up/Down to reorder</div>
        </div>

        <PlaceSearch @select="addStop" />

        <div v-if="!rs.stops?.length" class="empty muted">
          No stops yet. Use the place search above to add one.
        </div>

        <div v-for="(s, sIdx) in rs.stops" :key="s._id || sIdx" class="stop card">
          <div class="stop__head">
            <div class="stop__meta">
              <div class="stop__title">{{ s.title || s.place?.name || 'Stop' }}</div>
              <div class="stop__addr" v-if="s.place?.address">{{ s.place.address }}</div>
              <a
                v-if="s.place?.lat && s.place?.lng"
                :href="mapsUrl(s.place.lat, s.place.lng)"
                target="_blank" rel="noopener"
                class="link link--small"
                @click.stop
              >Open in Google Maps</a>
            </div>
            <div class="stop__actions">
              <button type="button" class="btn" @click.stop.prevent="moveStopUp(sIdx)" :disabled="sIdx===0">↑ Move Up</button>
              <button type="button" class="btn" @click.stop.prevent="moveStopDown(sIdx)" :disabled="sIdx===rs.stops.length-1">↓ Move Down</button>
              <button type="button" class="btn btn--ghost" @click.stop.prevent="removeStop(s._id)">Remove Stop</button>
            </div>
          </div>

          <textarea
            v-model="s.instructions"
            class="textarea"
            rows="2"
            placeholder="Driver instructions for this stop (dock access, hours, contact)…"
            @change="saveStop(s)"
          ></textarea>

          <!-- Items at stop -->
          <div class="stop__items">
            <div class="row row--tight">
              <h4 class="mini-title">Items at this stop</h4>
              <input v-model="itemSearch" placeholder="Search items…" class="input" />
              <button type="button" class="btn" @click.stop.prevent="searchItems">Search</button>
            </div>

            <div class="pillbar">
              <button
                v-for="it in itemResults"
                :key="it._id"
                class="pill"
                type="button"
                @click.stop.prevent="addItemToStop(s._id, it)"
              >+ {{ it.name }}</button>
            </div>

            <div class="items">
              <div v-for="(ri, idx) in s.items" :key="idx" class="item card">
                <div class="item__row">
                  <div class="item__name">{{ ri.name }}</div>
                  <div class="qty">
                    <label class="muted">Qty</label>
                    <input
                      type="number"
                      v-model.number="ri.quantity"
                      min="0"
                      class="input input--qty"
                      @change="save"
                    />
                    <button type="button" class="btn btn--danger" @click.stop.prevent="removeRunItem(s._id, idx)">Remove</button>
                  </div>
                </div>

                <textarea v-model="ri.notes" class="textarea" rows="2" placeholder="Notes…" @change="save"></textarea>

                <div class="row row--tight">
                  <span class="muted">Photos</span>
                  <input type="file" multiple @change="(e)=>uploadRunItemPhotos(s._id, idx, e)" />
                </div>
                <div class="thumbs thumbs--small">
                  <img
                    v-for="p in ri.photos || []"
                    :key="p"
                    :src="imageUrl(p)"
                    class="thumb__img thumb__img--sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Pickup/Delivering -->
<section class="panel">
  <div class="row">
    <h3 class="subtitle">Pickup/Delivering</h3>
    <div class="muted">Choose the service, payment method, timing, and completion info.</div>
  </div>

  <!-- Service type -->
  <div class="row row--tight">
    <div class="field">
      <div class="label">Service</div>
      <label class="radio">
        <input
          type="radio"
          value="pickup"
          v-model="rs.pdType"
          @change="savePickupDelivering"
        /> Pick Up
      </label>
      <label class="radio">
        <input
          type="radio"
          value="delivery"
          v-model="rs.pdType"
          @change="savePickupDelivering"
        /> Delivering
      </label>
    </div>

    <div class="field">
      <div class="label">Payment</div>
      <label class="radio">
        <input
          type="radio"
          value="cheque"
          v-model="rs.pdPaymentMethod"
          @change="savePickupDelivering"
        /> Cheque
      </label>
      <label class="radio">
        <input
          type="radio"
          value="cash"
          v-model="rs.pdPaymentMethod"
          @change="savePickupDelivering"
        /> Cash
      </label>
    </div>
  </div>

  <!-- Date / Time -->
  <div class="row row--wrap">
    <div class="field">
      <label class="label" for="pd-date">Date</label>
      <input id="pd-date" type="date" v-model="pdDateStr" @change="savePickupDelivering" />
    </div>

    <div class="field">
      <label class="label" for="pd-time">Time</label>
      <input id="pd-time" type="time" v-model="rs.pdTime" @change="savePickupDelivering" />
    </div>
  </div>

  <!-- Instructions -->
  <div class="field">
    <label class="label" for="pd-instr">Instructions</label>
    <textarea
      id="pd-instr"
      v-model="rs.pdInstructions"
      rows="2"
      placeholder="Notes or special instructions for pickup/delivery"
      @change="savePickupDelivering"
    ></textarea>
  </div>

  <!-- Completed by (user) -->
  <div class="row">
    <h4 class="mini-title">Completed By</h4>
    <div class="muted" v-if="completedByLabel">Current: {{ completedByLabel }}</div>
  </div>

  <div class="row row--tight">
    <input v-model="cbSearch" placeholder="Search users…" class="input" />
    <button type="button" class="btn" @click.stop.prevent="searchCompletedUsers">Search</button>
    <button
      v-if="rs.completedBy"
      type="button"
      class="btn btn--ghost"
      @click.stop.prevent="clearCompletedBy"
    >Unset</button>
  </div>

  <div class="pillbar">
    <button
      v-for="u in cbResults"
      :key="u._id"
      class="pill"
      type="button"
      @click.stop.prevent="selectCompletedBy(u)"
    >
      Use {{ u.name || u.email }}
    </button>
  </div>

  <!-- Date finished -->
  <div class="field">
    <label class="label" for="pd-finished">Date Finished</label>
    <input id="pd-finished" type="date" v-model="dateFinishedStr" @change="savePickupDelivering" />
  </div>
</section>

<!-- Return / Drop Off -->
<section class="panel">
  <div class="row">
    <h3 class="subtitle">Return / Drop Off</h3>
    <div class="muted">Pick PU or Take, toggle Cheque, set timing and completion info.</div>
  </div>

  <!-- PU / Take + Cheque toggle -->
  <div class="row row--tight">
    <div class="field">
      <div class="label">Service</div>
      <label class="radio">
        <input
          type="radio"
          value="pu"
          v-model="rs.rdType"
          @change="saveReturnDropoff"
        /> PU
      </label>
      <label class="radio">
        <input
          type="radio"
          value="take"
          v-model="rs.rdType"
          @change="saveReturnDropoff"
        /> Take
      </label>
    </div>

    <div class="field">
      <div class="label">Cheque</div>
      <label class="checkbox">
        <input
          type="checkbox"
          :checked="!!rs.rdCheque"
          @change="onToggleRdCheque"
        />
        <span>{{ rs.rdCheque ? 'On' : 'Off' }}</span>
      </label>
    </div>
  </div>

  <!-- Date / Time -->
  <div class="row row--wrap">
    <div class="field">
      <label class="label" for="rd-date">Return Date</label>
      <input id="rd-date" type="date" v-model="rdDateStr" @change="saveReturnDropoff" />
    </div>
    <div class="field">
      <label class="label" for="rd-time">Return Time</label>
      <input id="rd-time" type="time" v-model="rs.rdTime" @change="saveReturnDropoff" />
    </div>
  </div>

  <!-- Instructions -->
  <div class="field">
    <label class="label" for="rd-instr">Instructions</label>
    <textarea
      id="rd-instr"
      v-model="rs.rdInstructions"
      rows="2"
      placeholder="Notes for the return/drop-off"
      @change="saveReturnDropoff"
    ></textarea>
  </div>

  <!-- Completed By -->
  <div class="row">
    <h4 class="mini-title">Completed By</h4>
    <div class="muted" v-if="rdCompletedByLabel">Current: {{ rdCompletedByLabel }}</div>
  </div>

  <div class="row row--tight">
    <input v-model="cbSearch" placeholder="Search users…" class="input" />
    <button type="button" class="btn" @click.stop.prevent="searchCompletedUsers">Search</button>
    <button
      v-if="rs.rdCompletedBy"
      type="button"
      class="btn btn--ghost"
      @click.stop.prevent="clearRdCompletedBy"
    >Unset</button>
  </div>

  <div class="pillbar">
    <button
      v-for="u in cbResults"
      :key="u._id"
      class="pill"
      type="button"
      @click.stop.prevent="selectRdCompletedBy(u)"
    >
      Use {{ u.name || u.email }}
    </button>
  </div>

  <!-- Completed On -->
  <div class="field">
    <label class="label" for="rd-finished">Completed On</label>
    <input id="rd-finished" type="date" v-model="rdCompletedOnStr" @change="saveReturnDropoff" />
  </div>
</section>

<!-- Items Returned + Signature -->
<section class="panel">
  <div class="row">
    <h3 class="subtitle">Items Returned In Good Condition</h3>
  </div>

  <!-- Yes / No (stored as boolean) -->
  <div class="row row--tight">
    <label class="radio">
      <input
        type="radio"
        :checked="rs.qcItemsGood === true"
        @change="setItemsGood(true)"
      />
      Yes
    </label>
    <label class="radio">
      <input
        type="radio"
        :checked="rs.qcItemsGood === false"
        @change="setItemsGood(false)"
      />
      No
    </label>
    <span class="muted" v-if="itemsGoodSaving">Saving…</span>
  </div>

  <!-- Signature pad -->
  <div class="field">
    <div class="label">Signature</div>

    <div style="border:1px solid #ddd;border-radius:8px;padding:8px;">
      <canvas
        ref="sigCanvas"
        class="sigpad"
        style="width:100%;height:180px;touch-action:none;display:block;cursor:crosshair;"
        @mousedown="sigStart"
        @mousemove="sigMove"
        @mouseup="sigEnd"
        @mouseleave="sigEnd"
        @touchstart.prevent="sigStart"
        @touchmove.prevent="sigMove"
        @touchend.prevent="sigEnd"
      ></canvas>

      <div class="row row--tight" style="margin-top:8px;">
        <button type="button" class="btn btn--ghost" @click="clearSignature">Clear</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn--primary" @click="saveSignature" :disabled="sigSaving">
          {{ sigSaving ? 'Saving…' : 'Save Signature' }}
        </button>
      </div>
    </div>

    <!-- If you already have a saved signature, show a small preview -->
    <div v-if="rs.qcSignatureData" class="mt-2">
      <div class="muted">Saved signature preview:</div>
      <img :src="rs.qcSignatureData" alt="Saved signature" style="max-width:320px;max-height:120px;display:block;" />
    </div>
  </div>
</section>


      <!-- Assign to driver -->
      <section class="panel">
        <h3 class="subtitle">Assign to Driver</h3>
        <div class="row row--tight">
          <input v-model="userSearch" placeholder="Search users…" class="input" />
          <button type="button" class="btn" @click.stop.prevent="searchUsers">Search</button>
          <div class="muted" v-if="rs.assignedTo">Current: {{ rs.assignedTo?.name }}</div>
        </div>
        <div class="pillbar">
          <button
            v-for="u in userResults"
            :key="u._id"
            class="pill"
            type="button"
            @click.stop.prevent="assign(u)"
          >Assign {{ u.name }} ({{ u.role }})</button>
        </div>
      </section>

      <!-- Danger -->
      <section class="panel panel--danger danger-footer">
        <div class="row">
          <button type="button" class="btn" @click.stop.prevent="goToRunsheets">Back to list</button>
          <button type="button" class="btn btn--danger ml-auto" @click.stop.prevent="destroy">Delete Runsheet</button>
        </div>
      </section>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import PlaceSearch from '../components/PlaceSearch.vue';
import { useAuth } from '../stores/auth.js';
import api from '../api/index.js';

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const me = ref(null);
const itemsGoodSaving = ref(false);
const sigCanvas = ref(null);
let sigCtx = null;
let sigDrawing = false;
let sigLastX = 0;
let sigLastY = 0;
const sigSaving = ref(false);
const rs = ref({
  title: '',
  status: 'draft',
  date: null,
  photos: [],
  receipts: [],
  stops: [],
  purchaseType: 'purchase',
  pickupDate: null,
  returnDate: null,
  takeTo: null,
  set: null,

  // single-select contact (Person _id)
  contact: null,

  // Post-run destination
  postLocation: null,   // 'hold_on_truck' | 'office' | 'setdec_storage' | 'address_below' | null
  postAddress: '',      // for address_below
  postPlace: null,      // Place _id (optional helper for address_below)
   // --- Purchase / Payment (NEW) ---
  getInvoice: false,
  getDeposit: false,
  paid: false,
  chequeNumber: '',
  poNumber: '',
  amount: 0,
  paymentReceivedBy: '',
    // Pickup/Delivering (NEW)
    pdType: null,               // 'pickup' | 'delivery' | null
    pdPaymentMethod: null,      // 'cheque' | 'cash' | null
    pdDate: null,               // ISO string
    pdTime: '',                 // 'HH:MM'
    pdInstructions: '',
    completedBy: null,          // User _id or populated object
    dateFinished: null,         // ISO string
    rdType: null,           // 'pu' | 'take' | null
    rdCheque: false,        // boolean
    rdDate: null,           // ISO string
    rdTime: '',             // 'HH:MM'
    rdInstructions: '',     // string
    rdCompletedBy: null,    // User _id or populated user
    rdCompletedOn: null,    // ISO string (date only)
  });
  rs.value ??= {};
rs.value.qcItemsGood ??= null;     // boolean or null
rs.value.qcSignatureData ??= '';   // data URL string

const saving = ref(false);
const savedAt = ref('');
const error = ref('');

// People (for single-select contact)
const people = ref([]);
const peopleError = ref('');
const selectedPersonId = ref(null);
const contactSaving = ref(false);

// API base for images
const apiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api');
const imageUrl = (p) => apiBase.replace('/api','') + p;
const logout = () => auth.logout();

// Navigation helpers
const goToRunsheets = () => {
  router.push({ path: '/runsheets' }).catch(() => {
    const base = (router?.options?.history?.base || '').replace(/\/$/, '');
    location.assign(`${base}/runsheets`);
  });
};
const goToRunsheetView = () => {
  const id = rs.value?._id;
  if (!id) return;
  router.push({ name: 'runsheet-view', params: { id } })
    .catch(() => router.push(`/runsheets/${id}`))
    .catch(() => {});
};

// Date binders
const dateStr = computed({
  get() {
    if (!rs.value?.date) return '';
    const d = new Date(rs.value.date);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  },
  set(v) { rs.value.date = v ? new Date(v).toISOString() : null; }
});
const pickupStr = computed({
  get() {
    if (!rs.value?.pickupDate) return '';
    const d = new Date(rs.value.pickupDate);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  },
  set(v) { rs.value.pickupDate = v ? new Date(v).toISOString() : null; }
});
const returnStr = computed({
  get() {
    if (!rs.value?.returnDate) return '';
    const d = new Date(rs.value.returnDate);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  },
  set(v) { rs.value.returnDate = v ? new Date(v).toISOString() : null; }
});

const stamp = () => { savedAt.value = new Date().toLocaleTimeString(); };

// ---------- Load ----------
const load = async () => {
  try {
    rs.value = await api.get(`/runsheets/${route.params.id}`);

    // Legacy-safe defaults
    rs.value.purchaseType ??= 'purchase';
    rs.value.pickupDate ??= null;
    rs.value.returnDate ??= null;
    rs.value.takeTo ??= null;
    rs.value.set ??= null;
    rs.value.photos ??= [];
    rs.value.receipts ??= [];
    rs.value.postLocation ??= null;
    rs.value.postAddress ??= '';
    rs.value.postPlace ??= null;
    rs.value.pdType ??= null;
    rs.value.pdPaymentMethod ??= null;
    rs.value.pdDate ??= null;
    rs.value.pdTime ??= '';
    rs.value.pdInstructions ??= '';
    rs.value.completedBy ??= null;
    rs.value.dateFinished ??= null;

    // Purchase / Payment defaults
rs.value.getInvoice ??= false;
rs.value.getDeposit ??= false;
rs.value.paid ??= false;
rs.value.chequeNumber ??= '';
rs.value.poNumber ??= '';
rs.value.amount = Number.isFinite(+rs.value.amount) ? +rs.value.amount : 0;
rs.value.paymentReceivedBy ??= '';

rs.value.rdType ??= null;
rs.value.rdCheque = !!rs.value.rdCheque;
rs.value.rdDate ??= null;
rs.value.rdTime ??= '';
rs.value.rdInstructions ??= '';
rs.value.rdCompletedBy ??= null;
rs.value.rdCompletedOn ??= null;

    // Hydrate set if needed
    if (rs.value.set && typeof rs.value.set === 'string') {
      try {
        const setObj = await api.get(`/sets/${rs.value.set}`);
        if (setObj?._id) rs.value.set = setObj;
      } catch { /* ignore */ }
    }

    // Existing saved contact
    if (rs.value.contact) {
      selectedPersonId.value = typeof rs.value.contact === 'string'
        ? rs.value.contact
        : rs.value.contact?._id || null;
    } else {
      selectedPersonId.value = null;
    }

    await hydratePostPlace();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to load runsheet';
  }

  rs.value.qcItemsGood ??= null;
rs.value.qcSignatureData ??= '';

};

const setItemsGood = async (val) => {
  if (!rs.value?._id) return;
  itemsGoodSaving.value = true;
  try {
    rs.value.qcItemsGood = !!val;
    await api.patch(`/runsheets/${rs.value._id}`, { qcItemsGood: rs.value.qcItemsGood });
    stamp();
  } catch (e) {
    // if server rejects, revert to null
    rs.value.qcItemsGood = null;
    error.value = e?.response?.data?.error || 'Failed to save condition';
  } finally {
    itemsGoodSaving.value = false;
  }
};

// ---------- Signature pad helpers ----------
const getSigPos = (e) => {
  const rect = sigCanvas.value.getBoundingClientRect();
  const isTouch = e.touches && e.touches[0];
  const clientX = isTouch ? e.touches[0].clientX : e.clientX;
  const clientY = isTouch ? e.touches[0].clientY : e.clientY;
  const x = (clientX - rect.left) * (sigCanvas.value.width / rect.width);
  const y = (clientY - rect.top) * (sigCanvas.value.height / rect.height);
  return { x, y };
};

const sigStart = (e) => {
  if (!sigCtx) return;
  sigDrawing = true;
  const { x, y } = getSigPos(e);
  sigLastX = x; sigLastY = y;
};

const sigMove = (e) => {
  if (!sigDrawing || !sigCtx) return;
  const { x, y } = getSigPos(e);
  sigCtx.beginPath();
  sigCtx.moveTo(sigLastX, sigLastY);
  sigCtx.lineTo(x, y);
  sigCtx.stroke();
  sigLastX = x; sigLastY = y;
};

const sigEnd = () => { sigDrawing = false; };

const clearSignature = () => {
  if (!sigCtx || !sigCanvas.value) return;
  sigCtx.clearRect(0, 0, sigCanvas.value.width, sigCanvas.value.height);
};

const initSignatureCanvas = () => {
  if (!sigCanvas.value) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = sigCanvas.value.clientWidth || 600;
  const cssH = sigCanvas.value.clientHeight || 180;
  sigCanvas.value.width = Math.round(cssW * dpr);
  sigCanvas.value.height = Math.round(cssH * dpr);
  sigCtx = sigCanvas.value.getContext('2d');
  sigCtx.scale(dpr, dpr);
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  sigCtx.lineWidth = 2;
  sigCtx.strokeStyle = '#111';
};

// Optional: re-init on resize for crisp lines
let sigResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(sigResizeTimer);
  sigResizeTimer = setTimeout(initSignatureCanvas, 150);
});

// Save signature as a PNG data URL inside the runsheet
const saveSignature = async () => {
  if (!rs.value?._id || !sigCanvas.value) return;
  sigSaving.value = true;
  try {
    const dataUrl = sigCanvas.value.toDataURL('image/png');
    rs.value.qcSignatureData = dataUrl;
    await api.patch(`/runsheets/${rs.value._id}`, { qcSignatureData: dataUrl });
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save signature';
  } finally {
    sigSaving.value = false;
  }
};

const rdDateStr = computed({
  get() {
    if (!rs.value?.rdDate) return '';
    const d = new Date(rs.value.rdDate);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  },
  set(v) { rs.value.rdDate = v ? new Date(v).toISOString() : null; }
});

const rdCompletedOnStr = computed({
  get() {
    if (!rs.value?.rdCompletedOn) return '';
    const d = new Date(rs.value.rdCompletedOn);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  },
  set(v) { rs.value.rdCompletedOn = v ? new Date(v).toISOString() : null; }
});

const onToggleRdCheque = async (ev) => {
  const v = !!ev.target.checked;
  rs.value.rdCheque = v;
  ev.target.checked = v; // avoid flicker
  await saveReturnDropoff();
};

const selectRdCompletedBy = async (u) => {
  rs.value.rdCompletedBy = u;
  await saveReturnDropoff();
};

const clearRdCompletedBy = async () => {
  rs.value.rdCompletedBy = null;
  await saveReturnDropoff();
};

const rdCompletedByLabel = computed(() => {
  const v = rs.value.rdCompletedBy;
  if (!v) return '';
  if (typeof v === 'string') {
    const hit = (cbResults.value || []).find(x => x._id === v);
    return hit ? (hit.name || hit.email || hit._id) : `#${v}`;
  }
  return v.name || v.email || v._id || '';
});

const pdDateStr = computed({
  get() {
    if (!rs.value?.pdDate) return '';
    const d = new Date(rs.value.pdDate);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  },
  set(v) { rs.value.pdDate = v ? new Date(v).toISOString() : null; }
});

const dateFinishedStr = computed({
  get() {
    if (!rs.value?.dateFinished) return '';
    const d = new Date(rs.value.dateFinished);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  },
  set(v) { rs.value.dateFinished = v ? new Date(v).toISOString() : null; }
});

const saveReturnDropoff = async () => {
  if (!rs.value?._id) return;
  try {
    const payload = {
      rdType: rs.value.rdType ?? null,
      rdCheque: !!rs.value.rdCheque,
      rdDate: rs.value.rdDate ?? null,
      rdTime: rs.value.rdTime || '',
      rdInstructions: rs.value.rdInstructions || '',
      rdCompletedBy: rs.value.rdCompletedBy?._id ?? rs.value.rdCompletedBy ?? null,
      rdCompletedOn: rs.value.rdCompletedOn ?? null,
    };
    await api.patch(`/runsheets/${rs.value._id}`, payload);
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save return/drop-off';
  }
};

const loadPeople = async () => {
  try {
    people.value = await api.get('/people', { limit: 100 });
  } catch (e) {
    peopleError.value = e?.response?.data?.error || 'Failed to load people';
  }
};

const cbSearch = ref('');
const cbResults = ref([]);

const searchCompletedUsers = async () => {
  try {
    cbResults.value = await api.get('/users', { q: cbSearch.value });
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to search users';
  }
};

const selectCompletedBy = async (u) => {
  rs.value.completedBy = u; // optimistic for UI
  await savePickupDelivering();
};

const clearCompletedBy = async () => {
  rs.value.completedBy = null;
  await savePickupDelivering();
};

const completedByLabel = computed(() => {
  const v = rs.value.completedBy;
  if (!v) return '';
  if (typeof v === 'string') {
    const hit = cbResults.value.find(x => x._id === v);
    return hit ? (hit.name || hit.email || hit._id) : `#${v}`;
  }
  return v.name || v.email || v._id || '';
});

const savePickupDelivering = async () => {
  if (!rs.value?._id) return;
  try {
    const payload = {
      pdType: rs.value.pdType ?? null,
      pdPaymentMethod: rs.value.pdPaymentMethod ?? null,
      pdDate: rs.value.pdDate ?? null,
      pdTime: rs.value.pdTime || '',
      pdInstructions: rs.value.pdInstructions || '',
      completedBy: rs.value.completedBy?._id ?? rs.value.completedBy ?? null,
      dateFinished: rs.value.dateFinished ?? null,
    };
    await api.patch(`/runsheets/${rs.value._id}`, payload);
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save pickup/delivering';
  }
};

// ---------- Validate & Save core ----------
const validateBeforeSave = () => {
  if (rs.value.purchaseType === 'rental') {
    if (!rs.value.pickupDate || !rs.value.returnDate) {
      error.value = 'Rental runsheets require both pickup and return dates.';
      return false;
    }
    if (new Date(rs.value.returnDate) < new Date(rs.value.pickupDate)) {
      error.value = 'Return date cannot be before pickup date.';
      return false;
    }
  }
  if (rs.value.postLocation === 'address_below' && !rs.value.postAddress?.trim()) {
    // Allow if a Place was selected and provides address; otherwise require manual address.
    if (!selectedPostPlace.value?.address) {
      error.value = 'Please provide the address for "Address Below".';
      return false;
    }
  }
  return true;
};

const savePurchase = async () => {
  if (!rs.value?._id) return;
  try {
    const payload = {
      getInvoice: !!rs.value.getInvoice,
      getDeposit: !!rs.value.getDeposit,
      paid: !!rs.value.paid,
      chequeNumber: rs.value.chequeNumber || '',
      poNumber: rs.value.poNumber || '',
      amount: Number.isFinite(+rs.value.amount) ? +rs.value.amount : 0,
      paymentReceivedBy: rs.value.paymentReceivedBy || '',
    };
    await api.patch(`/runsheets/${rs.value._id}`, payload);
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save purchase info';
  }
};

const save = async () => {
  if (!rs.value?._id) return;
  if (!validateBeforeSave()) return;
  saving.value = true; error.value = '';

  const payload = {
    title: rs.value.title,
    status: rs.value.status,
    date: rs.value.date,
    purchaseType: rs.value.purchaseType,
    pickupDate: rs.value.pickupDate,
    returnDate: rs.value.returnDate,
    takeTo: rs.value.takeTo?._id ?? rs.value.takeTo ?? null,
    set: rs.value.set?._id ?? rs.value.set ?? null,

    // Post destination
    postLocation: rs.value.postLocation ?? null,
    postAddress: rs.value.postLocation === 'address_below'
      ? (rs.value.postAddress || selectedPostPlace.value?.address || '')
      : '',
    postPlace: rs.value.postLocation === 'address_below'
      ? (selectedPostPlace.value?._id ?? rs.value.postPlace ?? null)
      : null,
        // --- Purchase / Payment (NEW) ---
  getInvoice: !!rs.value.getInvoice,
  getDeposit: !!rs.value.getDeposit,
  paid: !!rs.value.paid,
  chequeNumber: rs.value.chequeNumber || '',
  poNumber: rs.value.poNumber || '',
  amount: Number.isFinite(+rs.value.amount) ? +rs.value.amount : 0,
  paymentReceivedBy: rs.value.paymentReceivedBy || '',
  pdType: rs.value.pdType ?? null,
  pdPaymentMethod: rs.value.pdPaymentMethod ?? null,
  pdDate: rs.value.pdDate ?? null,
  pdTime: rs.value.pdTime || '',
  pdInstructions: rs.value.pdInstructions || '',
  completedBy: rs.value.completedBy?._id ?? rs.value.completedBy ?? null,
  dateFinished: rs.value.dateFinished ?? null,
  rdType: rs.value.rdType ?? null,
  rdCheque: !!rs.value.rdCheque,
  rdDate: rs.value.rdDate ?? null,
  rdTime: rs.value.rdTime || '',
  rdInstructions: rs.value.rdInstructions || '',
  rdCompletedBy: rs.value.rdCompletedBy?._id ?? rs.value.rdCompletedBy ?? null,
  rdCompletedOn: rs.value.rdCompletedOn ?? null,
      
 
 
    };


  
  try {
    rs.value = await api.patch(`/runsheets/${rs.value._id}`, payload);
    rs.value.photos ??= [];
    rs.value.receipts ??= rs.value.receipts || [];

    // Rehydrate set for UI if only ID
    if (rs.value.set && typeof rs.value.set === 'string') {
      try {
        const setObj = await api.get(`/sets/${rs.value.set}`);
        if (setObj?._id) rs.value.set = setObj;
      } catch { /* ignore */ }
    }

    await hydratePostPlace();
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save';
  } finally {
    saving.value = false;
  }
};

// ---------- Contact selection (single-select) ----------
const saveContactSelection = async () => {
  if (!rs.value?._id) return;
  contactSaving.value = true;
  const wanted = selectedPersonId.value;
  try {
    await api.patch(`/runsheets/${rs.value._id}`, { contact: wanted || null });
    rs.value.contact = wanted || null; // optimistic
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save contact';
    selectedPersonId.value = rs.value?.contact || null; // revert
  } finally {
    contactSaving.value = false;
  }
};

const onTogglePerson = (p, ev) => {
  const willCheck = ev.target.checked;
  selectedPersonId.value = willCheck ? p._id : null;
  ev.target.checked = willCheck; // prevent flicker
  saveContactSelection();
};
const clearContact = () => {
  selectedPersonId.value = null;
  saveContactSelection();
};

const selectedPersonLabel = computed(() => {
  const id = selectedPersonId.value;
  if (!id) return '';
  const p = people.value.find(x => x._id === id);
  if (!p) return `#${id}`;
  const extra = [p.email, p.phone].filter(Boolean).join(' · ');
  return extra ? `${p.name} — ${extra}` : p.name;
});

// ---------- Post Location: place + address_below ----------
const selectedPostPlace = ref(null); // { _id, name, address } or null

const hydratePostPlace = async () => {
  // Normalize local helper based on rs.postPlace (id or populated)
  if (rs.value?.postPlace && typeof rs.value.postPlace === 'string') {
    try {
      const place = await api.get(`/places/${rs.value.postPlace}`);
      if (place?._id) selectedPostPlace.value = place;
    } catch { selectedPostPlace.value = null; }
  } else if (rs.value?.postPlace && typeof rs.value.postPlace === 'object') {
    selectedPostPlace.value = rs.value.postPlace;
  } else {
    selectedPostPlace.value = null;
  }
};

// Centralized saver for post fields
const savePostLocation = async () => {
  if (!rs.value?._id) return;
  try {
    const payload = {
      postLocation: rs.value.postLocation ?? null,
      postPlace: rs.value.postLocation === 'address_below'
        ? (selectedPostPlace.value?._id ?? null)
        : null,
      postAddress: rs.value.postLocation === 'address_below'
        ? (rs.value.postAddress || selectedPostPlace.value?.address || '')
        : '',
    };
    await api.patch(`/runsheets/${rs.value._id}`, payload);
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save post location';
  }
};

// One-of checkboxes handler
const togglePost = (key, ev) => {
  const willCheck = ev?.target?.checked ?? true;
  rs.value.postLocation = willCheck ? key : null;

  if (key !== 'address_below') {
    selectedPostPlace.value = null;
    rs.value.postPlace = null;
    rs.value.postAddress = '';
  }
  if (ev?.target) ev.target.checked = willCheck;

  savePostLocation();
};

// Choose & clear place when "Address Below" is active
const choosePostPlace = async (place) => {
  rs.value.postLocation = 'address_below';
  selectedPostPlace.value = place;
  rs.value.postPlace = place._id;
  // Pre-fill address from selected place if textarea empty
  if (!rs.value.postAddress) rs.value.postAddress = place.address || '';
  await savePostLocation();
};

const clearPostPlace = async () => {
  selectedPostPlace.value = null;
  rs.value.postPlace = null;
  rs.value.postAddress = '';
  await savePostLocation();
};

const postPlaceLabel = computed(() => {
  const p = selectedPostPlace.value;
  return p ? [p.name, p.address].filter(Boolean).join(' — ') : '';
});

const onPostAddressBlur = async () => {
  if (rs.value.postLocation === 'address_below') {
    await savePostLocation();
  }
};

// ---------- Delete ----------
const destroy = async () => {
  if (!confirm('Delete this runsheet?')) return;
  try {
    await api.del(`/runsheets/${rs.value._id}`);
    goToRunsheets();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to delete';
  }
};

// ---------- Photos ----------
const uploadPhotos = async (e) => {
  const fd = new FormData();
  [...e.target.files].forEach(f => fd.append('photos', f));
  try {
    const resp = await api.post(`/runsheets/${rs.value._id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    rs.value.photos = resp.photos;
    stamp();
  } catch (e2) {
    error.value = e2?.response?.data?.error || 'Failed to upload photos';
  } finally {
    e.target.value = '';
  }
};
const removePhoto = async (url) => {
  try {
    const resp = await api.del(`/runsheets/${rs.value._id}/photos`, { url });
    rs.value.photos = resp.photos;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to remove photo';
  }
};

// ---------- Receipts ----------
const uploadReceipts = async (e) => {
  const fd = new FormData();
  [...e.target.files].forEach(f => fd.append('receipts', f));
  try {
    const resp = await api.post(`/runsheets/${rs.value._id}/receipts`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    rs.value.receipts = resp.receipts || [];
    stamp();
  } catch (e2) {
    error.value = e2?.response?.data?.error || 'Failed to upload receipts';
  } finally {
    e.target.value = '';
  }
};
const removeReceipt = async (url) => {
  try {
    const resp = await api.del(`/runsheets/${rs.value._id}/receipts`, { url });
    rs.value.receipts = resp.receipts || [];
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to remove receipt';
  }
};
const isImage = (path) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path || '');

// ---------- Stops ----------
const addStop = async (place) => {
  try {
    const updated = await api.post(`/runsheets/${rs.value._id}/stops`, { place: place._id, title: place.name, instructions: '' });
    rs.value = updated;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to add stop';
  }
};
const saveStop = async (s) => {
  try {
    const updated = await api.patch(`/runsheets/${rs.value._id}/stops/${s._id}`, s);
    rs.value = updated;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to save stop';
  }
};
const removeStop = async (stopId) => {
  if (!confirm('Remove this stop?')) return;
  try {
    const updated = await api.del(`/runsheets/${rs.value._id}/stops/${stopId}`);
    rs.value = updated;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to remove stop';
  }
};

// Reorder
const moveStopUp = async (idx) => {
  if (idx <= 0) return;
  const arr = [...rs.value.stops];
  const [moved] = arr.splice(idx, 1);
  arr.splice(idx - 1, 0, moved);
  rs.value.stops = arr;
  await save();
};
const moveStopDown = async (idx) => {
  if (idx >= rs.value.stops.length - 1) return;
  const arr = [...rs.value.stops];
  const [moved] = arr.splice(idx, 1);
  arr.splice(idx + 1, 0, moved);
  rs.value.stops = arr;
  await save();
};

// ---------- Items ----------
const itemSearch = ref('');
const itemResults = ref([]);
const searchItems = async () => {
  try {
    itemResults.value = await api.get('/items', { q: itemSearch.value });
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to search items';
  }
};
const addItemToStop = async (stopId, it) => {
  try {
    const updated = await api.post(`/runsheets/${rs.value._id}/stops/${stopId}/items`, { itemId: it._id, quantity: 1 });
    rs.value = updated;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to add item to stop';
  }
};
const removeRunItem = async (stopId, idx) => {
  try {
    const stop = rs.value.stops.find(s => s._id === stopId);
    if (!stop) return;
    const next = { ...stop, items: stop.items.filter((_, i) => i !== idx) };
    const updated = await api.patch(`/runsheets/${rs.value._id}/stops/${stopId}`, next);
    rs.value = updated;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to remove run item';
  }
};
const uploadRunItemPhotos = async (stopId, idx, e) => {
  const fd = new FormData();
  [...e.target.files].forEach(f => fd.append('photos', f));
  try {
    await api.post(`/runsheets/${rs.value._id}/stops/${stopId}/items/${idx}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    await load();
    stamp();
  } catch (e2) {
    error.value = e2?.response?.data?.error || 'Failed to upload run-item photos';
  } finally {
    e.target.value = '';
  }
};

// ---------- Assign to driver ----------
const userSearch = ref('');
const userResults = ref([]);
const searchUsers = async () => {
  try {
    userResults.value = await api.get('/users', { q: userSearch.value });
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to search users';
  }
};
const assign = async (u) => {
  try {
    rs.value = await api.post(`/runsheets/${rs.value._id}/assign`, { userId: u._id });
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to assign';
  }
};

// ---------- Destination (Take To) ----------
const setTakeTo = async (place) => {
  try {
    const payload = { takeTo: place._id || place };
    rs.value = await api.patch(`/runsheets/${rs.value._id}`, payload);
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to set destination';
  }
};
const clearTakeTo = async () => {
  try {
    rs.value = await api.patch(`/runsheets/${rs.value._id}`, { takeTo: null });
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to clear destination';
  }
};

// ---------- Sets ----------
const setSearch = ref('');
const setResults = ref([]);
const searchSets = async () => {
  try {
    setResults.value = await api.get('/sets', setSearch.value ? { q: setSearch.value } : undefined);
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to search sets';
  }
};
const chooseSet = async (s) => {
  try {
    rs.value = await api.patch(`/runsheets/${rs.value._id}`, { set: s._id });
    rs.value.set = s; // keep populated for UI
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to link set';
  }
};
const clearSet = async () => {
  try {
    rs.value = await api.patch(`/runsheets/${rs.value._id}`, { set: null });
    rs.value.set = null;
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to clear set';
  }
};
const currentSetLabel = computed(() => {
  const v = rs.value.set;
  if (!v) return '';
  if (typeof v === 'string') return `#${v}`;
  return `${v.number} — ${v.name}`;
});

const mapsUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

onMounted(async () => {
  me.value = await auth.fetchMe();
  await Promise.all([load(), loadPeople()]);
  await searchSets();
  setTimeout(initSignatureCanvas, 0); // let layout settle first
});
</script>







<style scoped>
/* ---------- Layout ---------- */
.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 16px;
}

/* ---------- Panels / Cards ---------- */
.panel {
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  padding: 14px 16px;
  margin-bottom: 12px;
}
.panel--danger {
  border-color: #ffe2df;
  background: #fff8f7;
}
.header {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
}
.header .input--title {
  grid-column: 1 / -1;
}
.header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  grid-column: 1 / -1;
}
.saved { margin-left: auto; }

/* ---------- Typography ---------- */
.subtitle { font-size: 16px; font-weight: 700; color: #111827; margin: 0; }
.mini-title { font-size: 14px; font-weight: 600; }

/* ---------- Rows / Fields ---------- */
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.row--wrap { flex-wrap: wrap; }
.row--tight { justify-content: flex-start; gap: 8px; }
.field { display: grid; gap: 6px; }
.field.w-full { width: 100%; }
.label { font-size: 12px; color: #6b7280; }

/* ---------- Inputs ---------- */
.input,
.select,
.textarea {
  border: 1px solid #d6d6d6;
  background: #fff;
  color: #111;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}
.input { height: 34px; }
.input--title {
  height: 40px;
  font-size: 18px;
  font-weight: 600;
}
.input--date { width: 220px; }
.input--qty { width: 82px; text-align: right; }
.textarea { width: 100%; resize: vertical; min-height: 72px; }
.select { height: 34px; }

@media (max-width: 920px) {
  .header { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .header { grid-template-columns: 1fr; }
  .input--date, .select { width: 100%; }
}

/* ---------- Radios / Checkboxes ---------- */
.radio, .checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid #eaeaea;
  border-radius: 8px;
  background: #fafafa;
  cursor: pointer;
  user-select: none;
}
.radio input, .checkbox input { accent-color: #111827; }

/* ---------- Buttons ---------- */
.btn {
  appearance: none;
  border: 1px solid #d6d6d6;
  background: #f7f7f7;
  color: #1f2937;
  font: inherit;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  transition: background .15s ease, border-color .15s ease, transform .02s ease;
}
.btn:hover { background: #efefef; border-color: #cdcdcd; }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn--primary {
  background: #111827;
  color: #fff;
  border-color: #111827;
}
.btn--primary:hover { background: #0b1220; border-color: #0b1220; }
.btn--danger {
  background: #fff;
  color: #b42318;
  border-color: #f1b3ac;
}
.btn--danger:hover { background: #fff5f5; border-color: #eba79f; }
.btn--ghost {
  background: #fff;
  color: #1f2937;
}

/* ---------- Pills (search results) ---------- */
.pillbar {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;
}
.pill {
  border: 1px solid #e7e7e7;
  background: #fafafa;
  color: #111;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
}
.pill:hover { background: #f2f2f2; }

/* ---------- Select list (People) ---------- */
.selectlist { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.selectlist__item { background: #fff; border: 1px solid #ececec; border-radius: 10px; }
.selectlist__row {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 10px; padding: 10px 12px; cursor: pointer;
}
.selectlist__meta { min-width: 0; }
.selectlist__title { font-weight: 600; }
.selectlist__sub { font-size: 12px; color: #6b7280; }

/* ---------- Images / Thumbs ---------- */
.thumbs { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
.thumb { position: relative; width: 84px; height: 84px; }
.thumb__img {
  width: 100%; height: 100%;
  object-fit: cover;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fafafa;
}
.chip {
  position: absolute; top: -6px; right: -6px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #dcdcdc;
  display: grid; place-items: center;
  cursor: pointer;
}
.chip--x { font-weight: 600; }
.thumbs--small { gap: 6px; }
.thumb__img--sm {
  width: 56px; height: 56px;
  border-radius: 8px;
}

/* ---------- Stops ---------- */
.stop.card {
  border: 1px solid #ececec;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  padding: 12px;
  display: grid;
  gap: 10px;
}
.stop__head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.stop__meta { min-width: 0; }
.stop__title { font-weight: 700; }
.stop__addr { color: #6b7280; font-size: 12px; }
.stop__actions { display: flex; gap: 8px; }

/* ---------- Items within Stop ---------- */
.items { display: grid; gap: 10px; }
.item.card {
  border: 1px solid #f0f0f0; border-radius: 10px; padding: 10px 12px; background: #fff;
}
.item__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.item__name { font-weight: 600; }
.qty { display: inline-flex; align-items: center; gap: 6px; }

/* ---------- Links ---------- */
.link { color: #0b1220; text-decoration: underline; }
.link--small { font-size: 12px; }

/* ---------- Signature ---------- */
.sigpad {
  border: 1px dashed #d6d6d6;
  border-radius: 8px;
  background: #fff;
}
.sigpad:active { cursor: crosshair; }

/* ---------- Helpers ---------- */
.muted { color: #6b7280; font-size: 12px; }
.error {
  margin-top: 12px;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffd7d5;
  padding: 10px 12px;
  border-radius: 8px;
}
.empty { padding: 12px; text-align: center; color: #6b7280; }
.mt-1 { margin-top: 6px; }
.mt-2 { margin-top: 10px; }
.ml-auto { margin-left: auto; }

/* ---------- Footer danger row ---------- */
.danger-footer .row { align-items: center; }

/* ---------- Responsive ---------- */
@media (max-width: 760px) {
  .stop__head { flex-direction: column; align-items: flex-start; }
  .header__actions { justify-content: flex-start; }
}
</style>
