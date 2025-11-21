package com.codeyzer.ekstre;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(SmsReaderPlugin.class);
        registerPlugin(PdfParserPlugin.class);
        registerPlugin(SecureStoragePlugin.class);
        registerPlugin(OcrPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
