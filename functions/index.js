'use strict';

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getMessaging }      = require('firebase-admin/messaging');
const { getFirestore }      = require('firebase-admin/firestore');

initializeApp();

exports.notifyAdminOnEquipmentChange = onDocumentUpdated(
  'artifacts/{appId}/public/data/equipment/{docId}',
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    if (!before || !after || before.status === after.status) return;

    let title, body;
    if (after.status === 'borrowed') {
      title = `📻 ${after.name} ถูกยืม`;
      body  = `รหัสพนักงาน: ${after.currentBorrower?.empId || '-'}`;
    } else if (after.status === 'pending_return') {
      title = `🔄 ${after.name} ส่งคืนรอตรวจ`;
      body  = `จาก: ${after.currentBorrower?.empId || '-'}`;
    } else {
      return;
    }

    const db     = getFirestore();
    const appId  = event.params.appId;

    const tokensSnap = await db
      .collection(`artifacts/${appId}/public/data/adminTokens`)
      .get();

    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs
      .map(d => d.data().token)
      .filter(t => typeof t === 'string' && t.length > 20);

    if (!tokens.length) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon:  'https://supasiao7896th.github.io/RadioSync/icon-192.png',
          badge: 'https://supasiao7896th.github.io/RadioSync/icon-192.png',
          requireInteraction: false,
        },
        fcmOptions: {
          link: 'https://supasiao7896th.github.io/RadioSync/',
        },
      },
    });

    // Remove expired / invalid tokens automatically
    const staleIds = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('invalid-registration-token') ||
            code.includes('registration-token-not-registered')) {
          staleIds.push(tokensSnap.docs[i].id);
        }
      }
    });

    if (staleIds.length) {
      await Promise.all(
        staleIds.map(id =>
          db.doc(`artifacts/${appId}/public/data/adminTokens/${id}`).delete()
        )
      );
    }
  }
);
