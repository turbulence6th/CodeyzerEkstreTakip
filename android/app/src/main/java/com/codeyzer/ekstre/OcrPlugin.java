package com.codeyzer.ekstre;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.FileNotFoundException;
import java.io.InputStream;

@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    private static final String TAG = "OcrPlugin";
    private TextRecognizer recognizer;

    @Override
    public void load() {
        super.load();
        // ML Kit Text Recognizer'ı başlat
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        Log.d(TAG, "OCR Plugin loaded with ML Kit Text Recognition");
    }

    @PluginMethod
    public void recognizeText(PluginCall call) {
        String imageSource = call.getString("imageSource");
        String sourceType = call.getString("sourceType", "path"); // default: path

        if (imageSource == null || imageSource.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "Missing imageSource parameter");
            ret.put("text", "");
            call.resolve(ret);
            return;
        }

        try {
            InputImage image;

            if ("base64".equals(sourceType)) {
                // Base64 string'den görüntü oluştur
                image = createImageFromBase64(imageSource);
            } else {
                // Dosya yolundan görüntü oluştur
                image = createImageFromPath(imageSource);
            }

            if (image == null) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "Failed to create image from source");
                ret.put("text", "");
                call.resolve(ret);
                return;
            }

            // ML Kit ile OCR işlemi
            processImage(image, call);

        } catch (Exception e) {
            Log.e(TAG, "Error in recognizeText: " + e.getMessage(), e);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "OCR failed: " + e.getMessage());
            ret.put("text", "");
            call.resolve(ret);
        }
    }

    private InputImage createImageFromBase64(String base64String) {
        try {
            byte[] imageBytes = Base64.decode(base64String, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            if (bitmap == null) {
                Log.e(TAG, "Failed to decode bitmap from base64");
                return null;
            }
            return InputImage.fromBitmap(bitmap, 0);
        } catch (Exception e) {
            Log.e(TAG, "Error creating image from base64: " + e.getMessage(), e);
            return null;
        }
    }

    private InputImage createImageFromPath(String path) {
        try {
            Uri uri = Uri.parse(path);

            // Content URI ise
            if ("content".equals(uri.getScheme())) {
                return InputImage.fromFilePath(getContext(), uri);
            }

            // File URI ise
            if ("file".equals(uri.getScheme()) || !path.contains("://")) {
                // file:// prefix'ini kaldır
                String filePath = path.replace("file://", "");
                InputStream inputStream = getContext().getContentResolver().openInputStream(Uri.parse("file://" + filePath));
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                if (bitmap == null) {
                    Log.e(TAG, "Failed to decode bitmap from file path");
                    return null;
                }
                return InputImage.fromBitmap(bitmap, 0);
            }

            // Diğer durumlar için
            return InputImage.fromFilePath(getContext(), uri);

        } catch (FileNotFoundException e) {
            Log.e(TAG, "File not found: " + path, e);
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Error creating image from path: " + e.getMessage(), e);
            return null;
        }
    }

    private void processImage(InputImage image, final PluginCall call) {
        recognizer.process(image)
            .addOnSuccessListener(new OnSuccessListener<Text>() {
                @Override
                public void onSuccess(Text result) {
                    String extractedText = result.getText();
                    Log.d(TAG, "OCR Success. Extracted text length: " + extractedText.length());

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("text", extractedText);
                    ret.put("error", null);

                    // Metadata ekle
                    JSObject metadata = new JSObject();

                    // Text blocks bilgisi
                    JSArray blocks = new JSArray();
                    for (Text.TextBlock block : result.getTextBlocks()) {
                        JSObject blockObj = new JSObject();
                        blockObj.put("text", block.getText());

                        // Bounding box bilgisi
                        if (block.getBoundingBox() != null) {
                            JSObject bbox = new JSObject();
                            bbox.put("left", block.getBoundingBox().left);
                            bbox.put("top", block.getBoundingBox().top);
                            bbox.put("width", block.getBoundingBox().width());
                            bbox.put("height", block.getBoundingBox().height());
                            blockObj.put("boundingBox", bbox);
                        }

                        blocks.put(blockObj);
                    }

                    metadata.put("blocks", blocks);
                    metadata.put("blockCount", result.getTextBlocks().size());

                    ret.put("metadata", metadata);

                    call.resolve(ret);
                }
            })
            .addOnFailureListener(new OnFailureListener() {
                @Override
                public void onFailure(@NonNull Exception e) {
                    Log.e(TAG, "OCR Failed: " + e.getMessage(), e);

                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("text", "");
                    ret.put("error", "Text recognition failed: " + e.getMessage());

                    call.resolve(ret);
                }
            });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (recognizer != null) {
            recognizer.close();
            Log.d(TAG, "OCR Plugin destroyed, recognizer closed");
        }
    }
}
