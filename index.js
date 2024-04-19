const express = require('express')

const https = require('https');
const port = 5000;
const app = express()
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs-extra');
const dbPath = './db.json';
const crypto = require('crypto');
const cors = require('cors')
const partial = `api/test`
const path = require('path');
const { readFileSync } = require('fs');
const options = {
  key: readFileSync(path.resolve("certs/localhost+3-key.pem")),
  cert: readFileSync(path.resolve("certs/localhost+3.pem"))
}

const server = https.createServer(options,app)
// app.use(cors('https://localhost:3000',{'origin': true,optionsSuccessStatus:200}))

const acceptedOrigins = ["https://localhost:3000","https://127.0.0.1:3000","https://192.168.1.109:3000"]
// app.use((req,res,next) => {
//   console.log(`A middleware component ${req.headers.origin} | referer: ${req.headers.referer}`)
//   let origin = acceptedOrigins.includes(req.headers.origin) ? req.headers.origin : ""
//   res.header("Access-Control-Allow-Origin",origin)
//   res.header("Vary","Origin")
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// })

app.use(cors())
app.use(express.static('uploads'))
app.use(bodyParser.json());



function createUniqueId(value){
  let new_id =  crypto.createHash('sha1').update(value).digest("hex")
  return new_id
}

async function readDb() {
  try {
    return await fs.readJson(dbPath);
  } catch (err) {
    console.error('Error reading database:', err);
    return null;
  }
}

async function writeDb(data) {
  try {
    await fs.writeJson(dbPath, data);
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

const imageUniqueName = (file) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  return file.fieldname + '-' + uniqueSuffix + '-' + file.originalname

}
// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {

    let types = {"image":"images/"}
    let dir = types[file.fieldname]
    cb(null, `uploads/${dir}`);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });
const structureResponse = (outputData) => {
  const success = outputData !== null ? "success" : "failed"
  const status = success !== "failed" ? "200" : "400"
  return {data:outputData, status,success,access_token:""}
}



app.post(`/${partial}/login`, async (req, res) => {
  
  const {email} = req.body.data

    const db = await readDb()
    let found = db.users.find(user => user.email === email )
    console.log(`${JSON.stringify(found)}`)
    if(found.role === "mentor"){
      found = await groupMentors(found.id)
    }

    if(found.role === "artist"){
      found = await groupArtist(found.id)
    }

    let respondData = structureResponse(found)

    res.send(respondData)
})

app.post(`/${partial}/logout`, async (req, res) => {


    res.send({data:'user logged out'})
})


app.put(`/${partial}/users/:user_id`, upload.single('image') ,async (req,res) => {

  const db = await readDb();
  const user_id = req.params.user_id
  const dataToUpdate = req.body;

  const index = db.users.findIndex(user => user.id === user_id);
  let found_user = db.users[index]
  const image = req.file ? req.file.filename : null;
 const updatedData = {...found_user,...dataToUpdate}
 if(image !== null){
  const baseUrl = req.protocol + '://' + req.get('host');
  imageUrl = `${baseUrl}/images/${image}`;
    updatedData['image'] =  imageUrl
 }
 db.users[index] = updatedData;

 await writeDb(db);
 res.send({data:{...updatedData}})
})
// Add a new user

app.post(`/${partial}/users`, upload.single('image'), async (req, res) => {


  const { fullname,email,username, role } = req.body.data;

    const image = req.file ? req.file.filename : undefined;
    const created_id = createUniqueId((Math.random() * 1E9) + fullname)
    const newUser = { id:created_id, fullname ,email,username, role,created_at:Date(Date.now()) };


    
    const db = await readDb();  
    let found = db.users.findIndex((user) => {user.email === email})
    
    if(found !== -1){
      res.send({"failed":`The user already exists at index ${found} | ${db.users[found]}`})
      return false

    }
    
    if(role === "artist"){
      const newArtist = {id:createUniqueId((Math.random() * 1E9) + fullname), user_id:created_id,created_at:Date(Date.now())}
      db.artists.push(newArtist)
    }

    if(role === "mentor"){
      let {specialties} = req.body.data
    
      const newMentor = {id:createUniqueId((Math.random() * 1E9) + fullname), user_id:created_id,specialties,created_at:Date(Date.now())}
      db.mentors.push(newMentor)
    }

    if(role === "writer"){
      const newAdmin = {id:createUniqueId((Math.random() * 1E9) + fullname), user_id:created_id,created_at:Date(Date.now())}
      db.writers.push(newAdmin)
    }

    if(role === "admin"){
      const newAdmin = {id:createUniqueId((Math.random() * 1E9) + fullname), user_id:created_id,created_at:Date(Date.now())}
      db.admins.push(newAdmin)
    }


    db.users.push(newUser);
    await writeDb(db);
    let respondData = structureResponse(newUser)
    res.send( respondData);
  });

  app.get(`/${partial}/users/:user_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
     const users = db.users
     const found_user = users.find(user => user.id === req.params.user_id)
     res.send({data:{user:found_user}})
  })

  app.get(`/${partial}/users`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
      const response = db.users.length > 0 ? db.users : {"users":[]}
     res.send(response)
  })

  app.get(`/${partial}/artists/:user_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
     const users = db.artists
     const found_user = users.find(user => user.id === req.params.user_id)
     res.send({data:{user:found_user}})
  })

  const groupMentors = async (mentor_id) =>{
    const db = await readDb()
     let user = db.users.find(user => user.id === mentor_id);

    const {specialties,availability} = db.mentors.find(mentor => mentor.user_id === user.id)
    const mentees = db.mentor_mentees.filter(mentor_mentee => mentor_mentee.mentor_id === user.id)
    let artists = []
    if(mentees){
     mentees.filter((mentee) => {
        let {id,fullname,bio,image,genre,username} = db.users.find(user => user.id === mentee.artist_id)
        let {status,created_at} = mentee

      let nextSession = null;
      let progress = null
        let found = db.mentorSessions.find(session => {return (session.mentor_id === mentor_id) && (session.mentee_id === mentee.artist_id)})
        
        if(found){
          nextSession = found.nextSession
          progress = found.progress
        }
       
          artists.push({
            id,fullname,username,bio,
            image,genre,status,
            "requested_date":created_at,
            nextSession,
            progress,
            request_id:mentee.id
          })
        
      })
    } 
    return  {
      ...user,
      specialties,
      availability,
      mentees:artists,
    }
  }

  const groupArtist = async (user_id) =>{
    const db = await readDb()
     let user = db.users.find(user => user.id === user_id);
     let mentorSessions = [];
     let mentor = null;
  
    const  mentorInfo = db.mentor_mentees.find(mentor_mentee => (mentor_mentee.artist_id === user.id) && ( mentor_mentee.status === "approved"))
    if(mentorInfo){
      mentor = db.users.find( user => user.id === mentorInfo.mentor_id)
      if(db.mentorSessions){
        mentorSessions = db.mentorSessions.filter(mentorSession => (mentorSession.mentor_id === mentor.id) && (mentorSession.artist_id === user.id))
      }
 
    }

    return  {
      ...user,
      mentor,
      mentorSessions
    }
  }


  app.get(`/${partial}/mentors`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
     const mentors = db.users.filter(user => user.role === 'mentor')
     let mentors_combined = await Promise.all(mentors.map(async (mentor) => {
      const data = await groupMentors(mentor.id);
      return data;
    }));
     
 
     res.send({data:mentors_combined})
  })

  app.get(`/${partial}/mentors/:user_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
  
    const {user_id} = req.params
    let data = await groupMentors(user_id)
 
 
     res.send({data})
  })

  
  app.post(`/${partial}/mentors/:mentor_id/request/:artist_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
    const {mentor_id,artist_id} = req.params
     const db = await readDb()
     const new_request = {id:createUniqueId(`${artist_id}request`),mentor_id,artist_id,status:"pending",created_at:Date(Date.now())}
     let update = new Set(db.mentor_mentees)
      update.add(new_request)
     db.mentor_mentees = Array.from(update)
     await writeDb(db)
     res.send({data:{request:new_request}})
  })


  app.post(`/${partial}/mentors/approve/:request_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
    const {request_id} = req.params
     const db = await readDb()
     let index = db.mentor_mentees.findIndex(request => request.id === request_id);
     let found_request = db.mentor_mentees[index]
      if(found_request){
          found_request.status = "approved";
      }

      db.mentor_mentees[index] = found_request;
     await writeDb(db)
     res.send({data:{...found_request}})
  })


  app.get(`/${partial}/mentors/:mentor_id/request`, async (req,res) => {
    res.setHeader("content-type",'application/json')
    const {mentor_id} = req.params
     const db = await readDb()
     let found_request = db.mentor_mentees.find(request =>  request.mentor_id === mentor_id);

     res.send({data:{...found_request}})
  })

  
  app.post(`/${partial}/mentors/:mentor_id/availability/:open`, async (req,res) => {
    res.setHeader("content-type",'application/json')
    const {mentor_id,open} = req.params
     const db = await readDb()
     let index = db.mentors.findIndex(mentor =>  mentor.user_id === mentor_id);
     let found_user = db.mentors[index];
     let availability = open === "open" ? true : false

     const update = {...found_user,availability}
     db.mentors[index] = update;
 
    await writeDb(db)

     res.send({data:{...update}})
  })



  app.post(`/${partial}/mentors/:mentor_id/request/:id/approve`, async (req,res) => {
    res.setHeader("content-type",'application/json')

     const db = await readDb()

    let foundRequest =  db.mentor_mentees.find(request => {
        request.id === req.params.id && request.mentor_id === req.params.mentor_id
     })
     foundRequest.status = "approved"

     let index = db.mentor_mentees.findIndex(mentee => mentee.id === foundRequest.id)

     db.mentor_mentees[index] = foundRequest
     await writeDb(db);
     res.send({data:{request:foundRequest}})
  })

  app.get(`/${partial}/notes/:user_id/:type`, async (req,res) => {
    try{
      res.setHeader("content-type",'application/json')
      const db = await readDb()
      const {type,user_id} = req.params;
      const user = db.users.find(user => user.id === user_id)
      let notes = db.notes
      let data = [];
      
      if(type === 'recipient'){
          let recipient = user;
          let user_notes = notes.filter(note => note.recipient === user_id)
         user_notes.forEach(userNote => {
            let sender_id = userNote.sender
            userNote.sender = db.users.find(user => user.id === sender_id)
            userNote.recipient = recipient
         
            data.push(userNote)
          });

 
      }
    
 
      res.send({data,status:200})
    }
    catch(err){
        res.send({data:null,message:err.message,status:400})
    }

  })

  app.get(`/${partial}/notes/:note_id`, async (req,res) => {
    console.log(`reached the server`)
    const db = await readDb();
    const {note_id} = req.params
    const users = db.users;
    const note = db.notes.find(note => note.id === note_id)
    const recipient = users.find( user => user.id === note.recipient)
    const sender = users.find(user => user.id === note.sender)

    let data = {...note,sender,recipient};
    res.send({data})
  })


  app.post(`/${partial}/notes/:recipient_id`, async (req,res) => {
    try{
      res.setHeader("content-type",'application/json')
      const db = await readDb()
      const {recipient_id} = req.params;
      const {note, subject,sender} = req.body.data

      const id = createUniqueId(`${recipient_id}${Date.now()}${subject}`)
      const status = "unread"
      let newNote = {id,note,subject,sender,recipient:recipient_id,status,created_at:Date(Date.now())};
      db.notes.push(newNote)
      
      if(`priorMessage` in req.body.data){
        const {priorMessage} = req.body.data;
        const replyingToNoteIndex = db.notes.findIndex(note => note.id === priorMessage)
        const replyingToNote = db.notes[replyingToNoteIndex]
        const updatedPreviousNote = {...replyingToNote,status:"replied"} 
        db.notes[replyingToNoteIndex] = updatedPreviousNote
        
      }  
      
      await writeDb(db);
     res.send({data:newNote})
    }
    catch(err){
        res.send({message:err.message,status:400})
    }

  })


  app.post(`/${partial}/sessions/:mentor_id/schedule`, async (req,res) => {
      const {nextSession,mentee_id} = req.body.data;
      let convertNextSession = Date(new Date(nextSession))
      const {mentor_id} = req.params
      const db = await readDb()
      const maxSessions = 6
      let totalSessions = 0;
      let progress = 0
      if(db.mentorSessions && db.mentorSessions.length > 0){
       let sessions = db.mentorSessions.filter(session => (session.mentee_id === mentee_id) && (session.mentor_id === mentor_id))
        totalSessions = sessions.length;
        progress = (Math.floor(totalSessions/maxSessions) * 100).toFixed(0);
      }
    
      const status = "incomplete"
      const data = {id:createUniqueId(`${(Math.random() * 12) ** 3}`), nextSession:convertNextSession,mentee_id,mentor_id,progress,status}
      
      db.mentorSessions.push({...data})
      await writeDb(db);

      res.send({data})
  })



  app.get(`/${partial}/writers/:user_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
     const users = db.writers
     const found_user = users.find(user => user.id === req.params.user_id)
     res.send({data:{user:found_user}})
  })

  app.get(`/${partial}/admins/:user_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
     const users = db.admins
     const found_user = users.find(user => user.id === req.params.user_id)
     res.send({data:{user:found_user}})
  })

  app.post(`/${partial}/articles`, upload.single('image'), async (req, res) => {

    const { title,content,author_id,category } = req.body.data;
    const image = req.file ? req.file.filename : undefined;
    const created_id = createUniqueId((Math.random() * 1E9) + title)
    const newArticle = { id:created_id, title,content,author_id,category,image, created_at:Date(Date.now()) };
    const db = await readDb();
    db.articles.push(newArticle);
      await writeDb(db);
      res.send({ message: 'Article added', article: newArticle});
    });
    

    app.put(`/${partial}/articles/:article_id`, async (req,res) => {
      res.setHeader("content-type",'application/json')
       const db = await readDb()
       let update = req.body.data
       const articles = db.articles
       const found_article = articles.find(user => user.id === req.params.article_id)
       const index = articles.findIndex(article => article.id === article_id);
    
       const updatedArticle =   {...found_article,...update}
       db.articles[index] = updatedArticle;
       await writeDb(db)
       res.send({data:{updated:updatedArticle}})
    })

  app.get(`/${partial}/articles/:article_id`, async (req,res) => {
    res.setHeader("content-type",'application/json')
     const db = await readDb()
     const articles = db.articles
     const found_article = articles.find(user => user.id === req.params.article_id)
     res.send({data:{user:found_article}})
  })


 
  

  app.get(`/${partial}`, (req, res) => {
    // res.setHeader("content-type",'application/json')
    const imagePath = path.resolve(__dirname, 'upload/images', 'image-1711741030156-633333399-blueface.jpg');
    res.send({welcome:'Hello World!',image:`${path.resolve(imagePath)}`})
  })


server.listen(port ,"0.0.0.0",() => {
  console.log(`running on port: ${port}...`)
})