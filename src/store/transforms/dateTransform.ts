import { createTransform } from 'redux-persist';
// Serializable tipleri dataSlice'tan import etmek yerine burada da tanımlayabiliriz veya any kullanabiliriz.
// Slice'ı import etmek döngüsel bağımlılık yaratabilir. Şimdilik any kullanalım.

// Persist edilmeyecek gereksiz alanlar (HTML içerikleri, büyük objeler)
const FIELDS_TO_EXCLUDE = ['originalMessage', 'originalResponse', 'htmlContent', 'body', 'rawContent'];

// Item'dan gereksiz alanları temizle
const cleanItem = (item: any): any => {
    if (!item || typeof item !== 'object') return item;

    const cleaned = { ...item };
    FIELDS_TO_EXCLUDE.forEach(field => {
        delete cleaned[field];
    });
    return cleaned;
};

const dateTransform = createTransform<
    any, // inbound state type (slice state)
    any  // outbound state type (stored state)
>(
    // state -> storage (inbound): Gereksiz alanları temizle
    (inboundState, key) => {
        if (key === 'data' && inboundState && Array.isArray(inboundState.items)) {
            return {
                ...inboundState,
                items: inboundState.items.map(cleanItem)
            };
        }
        return inboundState;
    },
    // storage -> state (outbound): Depodan okunan state'i olduğu gibi döndür
    (outboundState, key) => {
        return outboundState;
    },
    // Bu transformun hangi slice'a uygulanacağını belirtelim
     { whitelist: ['data'] }
);

export default dateTransform; 