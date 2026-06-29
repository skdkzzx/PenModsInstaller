mount -o remount,rw /

cp -f patchelf /usr/bin/patchelf

chmod +x /usr/bin/patchelf

mv libm.so /lib/libm.so.6
mv libstdc++.so /usr/lib/libstdc++.so.6
mv libcrypt.so /lib/libcrypt.so.1

cp /lib/libm.so.6 libm.so
cp /lib/libcrypt.so.1 libcrypt.so
cp /usr/lib/libstdc++.so.6 libstdc++.so
