package com.codeyzer.ekstre;

import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "PdfParser")
public class PdfParserPlugin extends Plugin {

    private static final String TAG = "PdfParserPlugin";

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        PDFBoxResourceLoader.init(getContext());
    }

    @PluginMethod
    public void parsePdfText(PluginCall call) {
        String base64Data = call.getString("base64Data");

        if (base64Data == null || base64Data.isEmpty()) {
            call.resolve(getRet().put("error", "Missing or empty base64Data from JS"));
            return;
        }

        PDDocument document = null;
        InputStream inputStream = null;
        try {
            Log.d(TAG, "Decoding Base64 PDF data...");
            byte[] pdfBytes = Base64.decode(base64Data, Base64.DEFAULT);
            inputStream = new ByteArrayInputStream(pdfBytes);

            Log.d(TAG, "Loading PDF document with PDFBox...");
            document = PDDocument.load(inputStream);

            if (document.isEncrypted()) {
                Log.w(TAG, "PDF document is encrypted.");
                call.resolve(getRet().put("error", "PDF document is encrypted."));
                return;
            }

            Log.d(TAG, "Stripping text from PDF document (Page count: " + document.getNumberOfPages() + ")...");
            PDFTextStripper pdfStripper = new PDFTextStripper();
            String text = pdfStripper.getText(document);
            Log.d(TAG, "Successfully extracted text. Length: " + (text != null ? text.length() : "null"));

            JSObject ret = getRet();
            ret.put("text", text);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error parsing PDF: " + e.getClass().getSimpleName() + " - " + e.getMessage(), e);
            call.resolve(getRet().put("error", "Native PDF parsing failed: " + e.getMessage()));
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (Exception e) {
                    Log.e(TAG, "Error closing input stream", e);
                }
            }
            if (document != null) {
                try {
                    document.close();
                } catch (Exception e) {
                    Log.e(TAG, "Error closing PDDocument", e);
                }
            }
        }
    }

    @NonNull
    JSObject getRet() {
        return new JSObject();
    }
} 