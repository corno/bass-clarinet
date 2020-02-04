import * as bass_clarinet from "bass-clarinet"

var parser = bass_clarinet.parser();
parser.onvalue.subscribe((v: string) => {
  console.log("Value: " + v);
})
parser.onkey.subscribe((key: string) => {
  console.log("Key: " + key);
})
parser.onopenobject.subscribe(() => {
  console.log("New Object");
})
parser.oncloseobject.subscribe(() => {
  console.log("Close Object");
})
parser.onopenarray.subscribe(() => {
  console.log("New Array");
})
parser.onclosearray.subscribe(() => {
  console.log("Close Array");
})
parser.onend.subscribe(() => {
  console.log('End');
})

parser
  .write('{ "firstName": "John", "lastName": ')
  .write('"Smith", "age" : 25, "address" : { ')
  .write('"streetAddress": "21 2nd Street", "')
  .write('city" : "New York", "state" : "NY",')
  .write('"postalCode" : "10021" }, "phoneNum')
  .write('ber": [ { "type" : "home", "number"')
  .write(': "212 555-1234" }, { "type" : "fax')
  .write('", "number": "646 555-4567" } ] }')
  .close();
