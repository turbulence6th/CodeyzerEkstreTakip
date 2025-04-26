import { createTransform } from 'redux-persist';
import type { ParsedStatement, ParsedLoan } from '../../services/sms-parsing/types';
// Serializable tipleri dataSlice'tan import etmek yerine burada da tanımlayabiliriz veya any kullanabiliriz.
// Slice'ı import etmek döngüsel bağımlılık yaratabilir. Şimdilik any kullanalım.

// Type guards (string tarihli objeler için)
function isStatementWithStringDate(item: any): item is { dueDate: string } {
    return item && typeof item === 'object' && typeof item.dueDate === 'string';
}
function isLoanWithStringDate(item: any): item is { firstPaymentDate: string | null } {
    return item && typeof item === 'object' && (typeof item.firstPaymentDate === 'string' || item.firstPaymentDate === null);
}

const dateTransform = createTransform<
    any, // inbound state type (slice state)
    any  // outbound state type (stored state)
>(
    // state -> storage (inbound): Tarihleri ISO string'e çevir.
    // Bu, thunk içinde yapıldığı için burada tekrar yapmaya gerek YOK.
    // Ancak manuel girişlerde Date nesnesi gelme ihtimaline karşı yapılabilir.
    // Şimdilik boş bırakalım, thunk ve reducer'ın doğru formatta eklediğini varsayalım.
    (inboundState, key) => {
        // console.log(`Persisting state for key: ${key}`); 
        return inboundState; // Gelen state'i olduğu gibi depola (string tarihli olmalı)
    },
    // storage -> state (outbound): Depodan okunan string'leri state'e yazarken DÖNÜŞTÜRME.
    // State'in zaten string tarihli olmasını istiyoruz.
    (outboundState, key) => {
        // console.log(`Rehydrating state for key: ${key}`);
        // Depodan gelen state'i olduğu gibi döndür, DÖNÜŞÜM YAPMA.
        return outboundState; 
    },
    // Bu transformun hangi slice'a uygulanacağını belirtelim
     { whitelist: ['data'] }
);

export default dateTransform; 